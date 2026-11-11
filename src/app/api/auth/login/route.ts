import { NextRequest, NextResponse } from "next/server";
import { getShopFloorService } from "@/lib/business-central/service";
import { createOperatorSession } from "@/lib/session/session";
import type { Operator } from "@/lib/business-central/types";

export async function POST(request: NextRequest) {
  let body: { operatorCode?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid request." } },
      { status: 400 }
    );
  }

  const operatorCode = typeof body.operatorCode === "string" ? body.operatorCode.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!operatorCode || !password) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Enter your operator code and password." } },
      { status: 400 }
    );
  }

  const service = getShopFloorService();
  const result = await service.login(operatorCode, password);

  if (!result.ok) {
    // Never log the password. Only log the outcome + operator code.
    console.log(
      JSON.stringify({ at: new Date().toISOString(), scope: "auth-login", operatorCode, outcome: "failed" })
    );
    const status = result.error.code === "UNAUTHORIZED" ? 401 : result.error.code === "LOCKED" ? 423 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  const { sessionToken, ...operator } = result.data;
  await createOperatorSession({ ...operator, sessionToken });

  console.log(
    JSON.stringify({ at: new Date().toISOString(), scope: "auth-login", operatorCode, outcome: "success" })
  );

  const publicOperator: Operator = operator;
  return NextResponse.json({ ok: true, data: publicOperator });
}
