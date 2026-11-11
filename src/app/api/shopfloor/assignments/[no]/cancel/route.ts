import { NextRequest, NextResponse } from "next/server";
import { getShopFloorService } from "@/lib/business-central/service";
import { requireOperator, statusForErrorCode } from "@/lib/api-helpers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const guard = await requireOperator();
  if ("errorResponse" in guard) return guard.errorResponse;

  let body: { reason?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // reason is optional
  }
  const reason = typeof body.reason === "string" ? body.reason : "";

  const { no } = await params;
  // Role is re-checked on the BC side (Shop Floor Operator Context Mgt.TestIsSupervisorOrAdmin)
  // regardless of what this route or the client believes — this is defense in depth, not the
  // only check.
  const result = await getShopFloorService().cancelAssignment(guard.operator.sessionToken, decodeURIComponent(no), reason);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: statusForErrorCode(result.error.code) });
  }
  return NextResponse.json({ ok: true, data: result.data });
}
