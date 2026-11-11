import type { ApiError } from "@/lib/business-central/types";

type ClientResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** Thin wrapper around fetch for our own /api routes — not for calling BC directly. */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<ClientResult<T>> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const json = await response.json();
    if (!response.ok || json.ok === false) {
      return {
        ok: false,
        error: json.error ?? {
          code: "SERVER_ERROR",
          message: "Something went wrong. Please try again.",
        },
      };
    }
    return { ok: true, data: json.data as T };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Could not reach the server. Check your connection and try again.",
        detail: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
