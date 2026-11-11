import { NextResponse } from "next/server";
import { getOperatorSession, clearOperatorSession } from "@/lib/session/session";
import { getShopFloorService } from "@/lib/business-central/service";

export async function POST() {
  const session = await getOperatorSession();
  if (session) {
    // Best-effort: revoke the BC-side session too (Codeunit 78568.Logout),
    // same as "VWMS Session" revocation. The PWA's own cookie is cleared
    // regardless of whether this call succeeds.
    await getShopFloorService()
      .logout(session.sessionToken)
      .catch(() => undefined);
  }
  await clearOperatorSession();
  return NextResponse.json({ ok: true });
}
