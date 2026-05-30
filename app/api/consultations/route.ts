import { withApiHandler } from "@/lib/server/api/apiResponse";
import { parseDentalJsonBody, parseDentalRequest } from "@/lib/server/api/parseDentalRequest";
import {
  getConsultationByAppointment,
  getOrCreateConsultation,
} from "@/lib/server/services/videoConsultationService";
import { createDentalServiceContext } from "@/lib/server/services/shared/accessControl";
import { assertVideoEnabled } from "@/lib/server/planLimits";

export const dynamic = "force-dynamic";

/** GET /api/consultations?appointmentId= — статус консультации по записи. */
export const GET = withApiHandler(async (req) => {
  await assertVideoEnabled();
  const { gate, actor } = parseDentalRequest(req);
  const ctx = createDentalServiceContext(gate, actor);
  const url = new URL(req.url);
  const appointmentId = url.searchParams.get("appointmentId");
  if (!appointmentId?.trim()) {
    throw new Error("Нужен параметр appointmentId.");
  }
  return getConsultationByAppointment(ctx, appointmentId);
});

/** POST /api/consultations — создать или получить сессию { appointmentId }. */
export const POST = withApiHandler(async (req) => {
  await assertVideoEnabled();
  const { body, ctx: parsed } = await parseDentalJsonBody(req);
  const ctx = createDentalServiceContext(parsed.gate, parsed.actor);
  const appointmentId =
    typeof body.appointmentId === "string" ? body.appointmentId : "";
  if (!appointmentId.trim()) {
    throw new Error("Нужен appointmentId.");
  }
  return getOrCreateConsultation(ctx, appointmentId);
});
