import { withApiHandler } from "@/lib/server/api/apiResponse";
import { parseDentalJsonBody, parseDentalRequest } from "@/lib/server/api/parseDentalRequest";
import {
  insertAppointment,
  listAppointments,
} from "@/lib/server/services/appointmentService";
import { createDentalServiceContext } from "@/lib/server/services/shared/accessControl";

export const dynamic = "force-dynamic";

/** GET /api/appointments — список записей (фильтр по роли). */
export const GET = withApiHandler(async (req) => {
  const { gate, actor } = parseDentalRequest(req);
  const ctx = createDentalServiceContext(gate, actor);
  return listAppointments(ctx);
});

/** POST /api/appointments — создание записи (только client). */
export const POST = withApiHandler(async (req) => {
  const { body, ctx: parsed } = await parseDentalJsonBody(req);
  const ctx = createDentalServiceContext(parsed.gate, parsed.actor);
  return insertAppointment(ctx, body);
});
