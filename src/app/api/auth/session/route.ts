import { NextResponse } from "next/server";
import { getOperatorPublic } from "@/lib/session/session";

export async function GET() {
  const operator = await getOperatorPublic();
  if (!operator) {
    return NextResponse.json({ ok: true, data: null });
  }
  return NextResponse.json({ ok: true, data: operator });
}
