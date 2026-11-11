import { NextResponse } from "next/server";
import { getShopFloorService } from "@/lib/business-central/service";
import { requireOperator, statusForErrorCode } from "@/lib/api-helpers";

export async function GET() {
  const guard = await requireOperator();
  if ("errorResponse" in guard) return guard.errorResponse;

  const result = await getShopFloorService().getMyAssignments(guard.operator.sessionToken);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: statusForErrorCode(result.error.code) });
  }
  return NextResponse.json({ ok: true, data: result.data });
}
