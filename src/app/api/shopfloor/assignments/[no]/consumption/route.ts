import { NextRequest, NextResponse } from "next/server";
import { getShopFloorService } from "@/lib/business-central/service";
import { requireOperator, statusForErrorCode } from "@/lib/api-helpers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const guard = await requireOperator();
  if ("errorResponse" in guard) return guard.errorResponse;
  let body: { lineNo?: unknown; qtyConsumedBase?: unknown; remarks?: unknown };
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid request." } }, { status: 400 });
  }
  const lineNo = typeof body.lineNo === "number" ? body.lineNo : NaN;
  const qtyConsumedBase = typeof body.qtyConsumedBase === "number" ? body.qtyConsumedBase : NaN;
  const remarks = typeof body.remarks === "string" ? body.remarks : "";
  if (!Number.isInteger(lineNo) || lineNo <= 0 || !Number.isFinite(qtyConsumedBase) || qtyConsumedBase < 0) {
    return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Enter a valid BOM line and a non-negative consumption quantity." } }, { status: 400 });
  }
  const { no } = await params;
  const result = await getShopFloorService().saveConsumption(guard.operator.sessionToken, { assignmentNo: decodeURIComponent(no), lineNo, qtyConsumedBase, remarks: remarks.slice(0, 250) });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: statusForErrorCode(result.error.code) });
  return NextResponse.json({ ok: true, data: result.data });
}
