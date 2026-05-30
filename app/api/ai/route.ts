import { withApiHandler } from "@/lib/server/api/apiResponse";
import { parseDentalJsonBody } from "@/lib/server/api/parseDentalRequest";
import { runAiAssistant } from "@/lib/server/services/aiService";

export const dynamic = "force-dynamic";

/** POST /api/ai — AI-помощник врача и пациента. */
export const POST = withApiHandler(async (req) => {
  const { body, ctx } = await parseDentalJsonBody(req);
  return runAiAssistant(ctx.gate, ctx.actor, body);
});
