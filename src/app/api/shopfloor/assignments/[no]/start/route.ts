import { NextRequest, NextResponse } from "next/server";
import { getShopFloorService } from "@/lib/business-central/service";
import { requireOperator, statusForErrorCode } from "@/lib/api-helpers";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const guard = await requireOperator();
  if ("errorResponse" in guard) return guard.errorResponse;

  const { no } = await params;
  const result = await getShopFloorService().startWork(guard.operator.sessionToken, decodeURIComponent(no));
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: statusForErrorCode(result.error.code) });
  }
  return NextResponse.json({ ok: true, data: result.data });
}
