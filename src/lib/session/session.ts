import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import type { Operator, OperatorRole } from "@/lib/business-central/types";

/**
 * Operator session handling.
 *
 * This is the *operator's* login session — not to be confused with the
 * application-level Business Central OAuth token in ../business-central/auth.ts
 * (used only for the real adapter's own calls, where applicable).
 *
 * The cookie holds the operator's public identity PLUS the opaque BC session
 * token returned by Codeunit 78568 "Shop Floor Authentication API".Login.
 * That token is what BC actually re-validates on every sensitive action
 * (Shop Floor Operator Context Mgt.ResolveOperatorFromSession) — the PWA
 * itself is never the final authority on "who is this". The cookie is
 * HMAC-signed (not encrypted) so a client can't forge or edit it, but the
 * token has no meaning without the signature validating first, and it's
 * HTTP-only so client-side JS never sees it at all, matching the "VWMS
 * Session" pattern: raw token in the cookie, hash of it in BC.
 */

const COOKIE_NAME = "shopfloor_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hour shift-length session (matches Shop Floor Setup default)

export interface OperatorSessionData {
  operatorCode: string;
  displayName: string;
  role: OperatorRole;
  mustChangePassword: boolean;
  sessionToken: string;
}

function getSigningSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "Missing SESSION_SECRET environment variable. Set a long random value " +
        "in .env.local (see .env.example) — without it every login will fail."
    );
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function createOperatorSession(data: OperatorSessionData): Promise<void> {
  const payload = JSON.stringify(data);
  const encodedPayload = Buffer.from(payload).toString("base64url");
  const signature = sign(encodedPayload);
  const cookieValue = `${encodedPayload}.${signature}`;

  const store = await cookies();
  store.set(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Full session data including the BC session token — server-side/API-route use only. Never return this object directly from a route handler. */
export async function getOperatorSession(): Promise<OperatorSessionData | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const [encodedPayload, signature] = raw.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    return JSON.parse(payload) as OperatorSessionData;
  } catch {
    return null;
  }
}

/** Client-safe view of the session — strips the BC session token. This is what /api/auth/session returns. */
export async function getOperatorPublic(): Promise<Operator | null> {
  const session = await getOperatorSession();
  if (!session) return null;
  const { operatorCode, displayName, role, mustChangePassword } = session;
  return { operatorCode, displayName, role, mustChangePassword };
}

export async function clearOperatorSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
