import "server-only";
import { getBcConfig } from "./config";
import {
  getBusinessCentralAccessToken,
  refreshBusinessCentralAccessToken,
} from "./auth";
import { apiErrorFromHttpStatus, networkError } from "./errors";
import type { ApiResult } from "./types";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** Path relative to the company API root, for example `shopFloorAssignments?$top=1`. */
  path: string;
  body?: unknown;
  correlationId?: string;
}

const JSON_ACCEPT = "application/json;odata.metadata=minimal";

/** Standard Microsoft Business Central API v2.0 request. */
export async function businessCentralRequest<T>(
  options: RequestOptions
): Promise<ApiResult<T>> {
  const config = getBcConfig();
  if (config.mode === "demo") {
    throw new Error("businessCentralRequest() called in demo mode. Use the demo adapter instead.");
  }

  const url = `${config.baseUrl}/companies(${config.companyId})/${stripLeadingSlash(options.path)}`;
  return rawBcFetch<T>(url, options);
}

/** Calls this extension's automatically published custom API pages. */
export async function shopFloorApiRequest<T>(
  options: RequestOptions
): Promise<ApiResult<T>> {
  const config = getBcConfig();
  if (config.mode === "demo") {
    throw new Error("shopFloorApiRequest() called in demo mode. Use the demo adapter instead.");
  }

  const url = `${config.shopFloorApiBaseUrl}/companies(${config.companyId})/${stripLeadingSlash(options.path)}`;
  return rawBcFetch<T>(url, options);
}

/**
 * Shared authenticated fetch for both API pages and OData V4 codeunit actions.
 * A single 401 triggers one token refresh/retry. Non-idempotent operations are
 * not retried for any other status, including 429 and 5xx.
 */
async function fetchWithBcAuth(url: string, init: RequestInit): Promise<Response> {
  const firstToken = await getBusinessCentralAccessToken();
  const firstHeaders = new Headers(init.headers);
  firstHeaders.set("Authorization", `Bearer ${firstToken}`);

  const firstResponse = await fetch(url, {
    ...init,
    headers: firstHeaders,
    cache: "no-store",
  });

  if (firstResponse.status !== 401) return firstResponse;

  const freshToken = await refreshBusinessCentralAccessToken(firstToken);
  const retryHeaders = new Headers(init.headers);
  retryHeaders.set("Authorization", `Bearer ${freshToken}`);

  return fetch(url, {
    ...init,
    headers: retryHeaders,
    cache: "no-store",
  });
}

async function rawBcFetch<T>(url: string, options: RequestOptions): Promise<ApiResult<T>> {
  try {
    const response = await fetchWithBcAuth(url, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: JSON_ACCEPT,
        ...(options.correlationId ? { "X-Correlation-Id": options.correlationId } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logBcCall(options, response.status);
      return { ok: false, error: apiErrorFromHttpStatus(response.status, text.slice(0, 700)) };
    }

    logBcCall(options, response.status);
    if (response.status === 204) return { ok: true, data: undefined as T };

    const text = await response.text();
    if (!text) return { ok: true, data: undefined as T };
    try {
      return { ok: true, data: JSON.parse(text) as T };
    } catch {
      return {
        ok: false,
        error: {
          code: "SERVER_ERROR",
          message: "Business Central returned a response that was not valid JSON.",
          detail: text.slice(0, 300),
          httpStatus: response.status,
        },
      };
    }
  } catch (err) {
    return { ok: false, error: networkError(err instanceof Error ? err.message : String(err)) };
  }
}

/**
 * Calls one of the extension's OData V4 unbound codeunit actions.
 * The Web Services page Service Name and procedure name are joined with `_`.
 */
export async function callODataAction<T>(
  serviceName: string,
  procedureName: string,
  params: Record<string, unknown>,
): Promise<ApiResult<T>> {
  const config = getBcConfig();
  if (config.mode === "demo") {
    throw new Error("callODataAction() called in demo mode. Use the demo adapter instead.");
  }

  const url = buildODataActionUrl(
    config.odataActionBaseUrl,
    serviceName,
    procedureName,
    config.companyId,
  );

  try {
    const response = await fetchWithBcAuth(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: JSON_ACCEPT,
      },
      // AL procedure parameter names and casing must be preserved exactly.
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(JSON.stringify({
        at: new Date().toISOString(),
        scope: "business-central-odata-action",
        serviceName,
        procedureName,
        actionName: `${serviceName}_${procedureName}`,
        status: response.status,
      }));

      // A 404 for an OData action is almost always a Web Services publication /
      // Service Name mismatch. Distinguish it from a missing company or record:
      // the latter does not produce "Resource not found for the segment".
      const missingSegment = text.match(/Resource not found for the segment\s+['\"]([^'\"]+)['\"]/i)?.[1];
      if (response.status === 404 && missingSegment) {
        const expectedAction = `${serviceName}_${procedureName}`;
        const objectId = serviceName === config.authServiceName
          ? "78568"
          : serviceName === config.actionsServiceName
            ? "78569"
            : "the codeunit used by this service";
        return {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: `Business Central does not expose the OData action "${missingSegment}". In this environment, publish Codeunit ${objectId} on Web Services with Service Name "${serviceName}" and Published enabled. The expected action is "${expectedAction}".`,
            detail: text.slice(0, 700),
            httpStatus: response.status,
          },
        };
      }

      return { ok: false, error: apiErrorFromHttpStatus(response.status, text.slice(0, 700)) };
    }

    // OData returns 204 for a procedure with no return value (for example Logout).
    if (response.status === 204) return { ok: true, data: undefined as T };

    const envelope = await response.json().catch(() => null) as
      | { value?: unknown }
      | null;
    if (!envelope || !Object.prototype.hasOwnProperty.call(envelope, "value")) {
      return {
        ok: false,
        error: {
          code: "SERVER_ERROR",
          message: "Business Central returned an unexpected OData action response.",
        },
      };
    }

    let parsed: unknown = envelope.value;
    if (typeof parsed === "string") {
      const responseText = parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        return {
          ok: false,
          error: {
            code: "SERVER_ERROR",
            message: "Business Central returned text that was not valid JSON from the shop-floor action.",
            detail: responseText.slice(0, 300),
          },
        };
      }
    }

    if (parsed && typeof parsed === "object" && "success" in parsed && parsed.success === false) {
      const failure = parsed as { message?: unknown; code?: unknown };
      const message = typeof failure.message === "string"
        ? failure.message
        : "The request was rejected by Business Central.";
      const code = failure.code === "UNAUTHORIZED" || failure.code === "FORBIDDEN" || failure.code === "NOT_FOUND"
        ? failure.code
        : "VALIDATION_ERROR";
      return { ok: false, error: { code, message } };
    }

    return { ok: true, data: parsed as T };
  } catch (err) {
    return { ok: false, error: networkError(err instanceof Error ? err.message : String(err)) };
  }
}

function buildODataActionUrl(
  base: string,
  serviceName: string,
  procedureName: string,
  companyId: string,
): string {
  const url = new URL(
    `${base}/${encodeURIComponent(serviceName)}_${encodeURIComponent(procedureName)}`
  );
  // Business Central supports company ID or display name here. Use the company
  // GUID already required by the API-page connection, so no hidden name setting
  // is needed and special characters in company names cannot break the URL.
  url.searchParams.set("company", companyId);
  return url.toString();
}

function stripLeadingSlash(path: string): string {
  return path.replace(/^\/+/, "");
}

function logBcCall(options: RequestOptions, status: number) {
  console.log(JSON.stringify({
    at: new Date().toISOString(),
    scope: "business-central-client",
    method: options.method ?? "GET",
    path: options.path,
    status,
    correlationId: options.correlationId,
  }));
}
