import "server-only";

/**
 * Central Business Central configuration.
 * Keep this module server-only: it contains the client secret.
 */
export type BcMode = "demo" | "sandbox" | "production";

interface DemoConfig {
  mode: "demo";
}

interface LiveConfig {
  mode: "sandbox" | "production";
  tenantId: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  environmentName: string;
  companyId: string;
  baseUrl: string;
  authorityUrl: string;
  shopFloorApiBaseUrl: string;
  odataActionBaseUrl: string;
  authServiceName: string;
  actionsServiceName: string;
}

export type BcConfig = DemoConfig | LiveConfig;

function readMode(): BcMode {
  const raw = (process.env.BC_MODE ?? "demo").trim().toLowerCase();
  if (raw === "demo" || raw === "sandbox" || raw === "production") return raw;
  throw new Error(`Invalid BC_MODE "${raw}". Use demo, sandbox, or production.`);
}

function readOptional(name: string): string {
  return (process.env[name] ?? "").trim();
}

function required(name: string): string {
  const value = readOptional(name);
  if (!value) {
    throw new Error(`Missing required environment variable "${name}" for BC_MODE=${readMode()}.`);
  }
  return value;
}

function withoutTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

function normalizeCompanyId(value: string): string {
  const normalized = value.trim().replace(/^\{|\}$/g, "").toLowerCase();
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (!guidPattern.test(normalized)) {
    throw new Error(
      'BC_COMPANY_ID must be the company GUID returned by GET /api/v2.0/companies (not the company display name).'
    );
  }
  return normalized;
}

let cached: BcConfig | null = null;

export function getBcConfig(): BcConfig {
  if (cached) return cached;

  const mode = readMode();
  if (mode === "demo") {
    cached = { mode: "demo" };
    return cached;
  }

  const tenantId = required("BC_TENANT_ID");
  const clientId = required("BC_CLIENT_ID");
  const clientSecret = required("BC_CLIENT_SECRET");
  // Client-credentials tokens must request the resource's /.default scope.
  // Keep this overridable for sovereign clouds or a custom auth configuration.
  const scope = readOptional("BC_SCOPE") || "https://api.businesscentral.dynamics.com/.default";
  const environmentName = readOptional("BC_ENVIRONMENT_NAME") ||
    (mode === "production" ? "Production" : "Sandbox");
  const companyId = normalizeCompanyId(required("BC_COMPANY_ID"));
  const authorityUrl = withoutTrailingSlash(
    readOptional("BC_AUTHORITY_URL") || `https://login.microsoftonline.com/${tenantId}`
  );

  const environmentRoot = `https://api.businesscentral.dynamics.com/v2.0/${encodePathSegment(tenantId)}/${encodePathSegment(environmentName)}`;
  const baseUrl = withoutTrailingSlash(readOptional("BC_BASE_URL") || `${environmentRoot}/api/v2.0`);
  const shopFloorApiBaseUrl = withoutTrailingSlash(
    readOptional("BC_SHOPFLOOR_API_BASE_URL") || `${environmentRoot}/api/velvotix/shopFloor/v1.0`
  );
  const odataActionBaseUrl = withoutTrailingSlash(
    readOptional("BC_ODATA_BASE_URL") || `${environmentRoot}/ODataV4`
  );

  cached = {
    mode,
    tenantId,
    clientId,
    clientSecret,
    scope,
    environmentName,
    companyId,
    baseUrl,
    authorityUrl,
    shopFloorApiBaseUrl,
    odataActionBaseUrl,
    // These are the Web Services page Service Name values documented in README.
    // They are intentionally not derived from the AL object names.
    authServiceName: readOptional("BC_AUTH_SERVICE_NAME") || "ShopFloorAuthenticationAPI",
    actionsServiceName: readOptional("BC_ACTIONS_SERVICE_NAME") || "ShopFloorAssemblyActionsAPI",
  };
  return cached;
}

/** Test-only helper to force re-read of env on next getBcConfig() call. */
export function _resetConfigCacheForTests() {
  cached = null;
}
