import { NextRequest, NextResponse } from "next/server";
import { getShopFloorService } from "@/lib/business-central/service";
import { requireOperator, statusForErrorCode } from "@/lib/api-helpers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const guard = await requireOperator();
  if ("errorResponse" in guard) return guard.errorResponse;

  let body: { pause?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // no body is fine — defaults to pause=false below
  }
  const pause = body.pause === true;

  const { no } = await params;
  const result = await getShopFloorService().stopWork(guard.operator.sessionToken, decodeURIComponent(no), pause);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: statusForErrorCode(result.error.code) });
  }
  return NextResponse.json({ ok: true, data: result.data });
}
