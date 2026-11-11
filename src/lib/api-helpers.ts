import { NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/session/session";
import type { OperatorSessionData } from "@/lib/session/session";

/** Shared guard for API routes that require an authenticated operator. Returns the full session (including the BC session token needed to call BC) — never send this object to the client as-is. */
export async function requireOperator(): Promise<
  { operator: OperatorSessionData } | { errorResponse: NextResponse }
> {
  const operator = await getOperatorSession();
  if (!operator) {
    return {
      errorResponse: NextResponse.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Please log in again." } },
        { status: 401 }
      ),
    };
  }
  return { operator };
}

/** Maps an ApiError code to an HTTP status for the route's response. */
export function statusForErrorCode(code: string): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "RATE_LIMITED":
      return 429;
    case "LOCKED":
      return 423;
    case "NOT_IMPLEMENTED":
      return 501;
    case "VALIDATION_ERROR":
    case "CONFIG_ERROR":
      return 400;
    case "NETWORK_ERROR":
    case "SERVER_ERROR":
    default:
      return 502;
  }
}
