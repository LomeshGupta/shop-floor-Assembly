import { NextRequest, NextResponse } from "next/server";
import { getShopFloorService } from "@/lib/business-central/service";
import { requireOperator, statusForErrorCode } from "@/lib/api-helpers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const guard = await requireOperator();
  if ("errorResponse" in guard) return guard.errorResponse;

  let body: { qtyToPostBase?: unknown; isFinal?: unknown; idempotencyKey?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid request." } },
      { status: 400 }
    );
  }

  const qtyToPostBase = typeof body.qtyToPostBase === "number" ? body.qtyToPostBase : NaN;
  const isFinal = body.isFinal === true;
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";

  if (!Number.isFinite(qtyToPostBase) || qtyToPostBase <= 0) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Enter a quantity greater than zero." } },
      { status: 400 }
    );
  }
  if (!idempotencyKey) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Missing idempotency key." } },
      { status: 400 }
    );
  }

  const { no } = await params;
  const assignmentNo = decodeURIComponent(no);
  const result = await getShopFloorService().reportOutput(guard.operator.sessionToken, {
    assignmentNo,
    qtyToPostBase,
    isFinal,
    idempotencyKey,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: statusForErrorCode(result.error.code) });
  }
  return NextResponse.json({ ok: true, data: result.data });
}
