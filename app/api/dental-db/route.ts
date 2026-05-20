import { NextResponse } from "next/server";

import type { DentalGatewayRequestBody } from "@/lib/dentalGwTypes";
import { dentalDbGateway } from "@/lib/server/dentalDbGateway";
import { DentalGateError } from "@/lib/server/dentalGateVerify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DentalGatewayRequestBody;
    const data = await dentalDbGateway(body);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    if (e instanceof DentalGateError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
