import "server-only";
import { getBcConfig } from "./config";

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

let tokenCache: CachedToken | null = null;
let tokenRequest: Promise<CachedToken> | null = null;
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

async function fetchNewToken(): Promise<CachedToken> {
  const config = getBcConfig();
  if (config.mode === "demo") {
    throw new Error("Business Central OAuth was requested while BC_MODE=demo.");
  }

  const tokenUrl = `${config.authorityUrl}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: config.scope,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as
    | { access_token?: unknown; expires_in?: unknown; error?: unknown; error_description?: unknown }
    | null;

  if (!response.ok) {
    const detail = typeof payload?.error_description === "string"
      ? payload.error_description
      : typeof payload?.error === "string"
        ? payload.error
        : `HTTP ${response.status}`;
    throw new Error(`Microsoft Entra token request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  if (typeof payload?.access_token !== "string" || !payload.access_token) {
    throw new Error("Microsoft Entra returned a successful response without an access_token.");
  }

  const expiresIn = Number(payload.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error("Microsoft Entra returned an invalid token expiry value.");
  }

  return {
    accessToken: payload.access_token,
    expiresAtMs: Date.now() + expiresIn * 1000,
  };
}

/** Returns an app-only Business Central token, coalescing concurrent refreshes. */
export async function getBusinessCentralAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAtMs - EXPIRY_SAFETY_MARGIN_MS > Date.now()) {
    return tokenCache.accessToken;
  }

  if (!tokenRequest) {
    tokenRequest = fetchNewToken().finally(() => {
      tokenRequest = null;
    });
  }

  tokenCache = await tokenRequest;
  return tokenCache.accessToken;
}

/**
 * Invalidate only the token rejected by BC. This avoids clearing a newer token
 * if another concurrent request has already refreshed the cache.
 */
export async function refreshBusinessCentralAccessToken(rejectedToken: string): Promise<string> {
  if (tokenCache?.accessToken === rejectedToken) tokenCache = null;
  return getBusinessCentralAccessToken();
}

export function _clearTokenCacheForTests() {
  tokenCache = null;
  tokenRequest = null;
}
