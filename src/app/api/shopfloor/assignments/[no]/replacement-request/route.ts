import { NextRequest, NextResponse } from "next/server";
import { getShopFloorService } from "@/lib/business-central/service";
import { requireOperator, statusForErrorCode } from "@/lib/api-helpers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const guard = await requireOperator();
  if ("errorResponse" in guard) return guard.errorResponse;
  let body: { lineNo?: unknown; replacementItemNo?: unknown; reason?: unknown };
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid request." } }, { status: 400 });
  }
  const lineNo = typeof body.lineNo === "number" ? body.lineNo : NaN;
  const replacementItemNo = typeof body.replacementItemNo === "string" ? body.replacementItemNo.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!Number.isInteger(lineNo) || lineNo <= 0 || !replacementItemNo || !reason) {
    return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Select a replacement item and enter the reason." } }, { status: 400 });
  }
  const { no } = await params;
  const result = await getShopFloorService().requestReplacement(guard.operator.sessionToken, { assignmentNo: decodeURIComponent(no), lineNo, replacementItemNo, reason: reason.slice(0, 250) });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: statusForErrorCode(result.error.code) });
  return NextResponse.json({ ok: true, data: result.data });
}
