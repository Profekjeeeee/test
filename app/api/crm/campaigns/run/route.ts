import { NextResponse } from "next/server";

import { runMarketingCampaign } from "@/lib/server/crmMarketing";
import { AdminApiAuthError, requireAdminFromRequest } from "@/lib/server/requireAdminApi";

export const dynamic = "force-dynamic";

/**
 * POST { campaignId: string }
 * Authorization: Bearer access_token админа
 */
export async function POST(request: Request) {
  try {
    await requireAdminFromRequest(request);
  } catch (e) {
    if (e instanceof AdminApiAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const campaignId =
    body && typeof body === "object" && typeof (body as { campaignId?: unknown }).campaignId === "string"
      ? (body as { campaignId: string }).campaignId.trim()
      : "";

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  try {
    const result = await runMarketingCampaign(campaignId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "run failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
