import { handleApiError, jsonOk } from "@/lib/server/api/apiResponse";
import { parseDentalJsonBody, parseDentalRequest } from "@/lib/server/api/parseDentalRequest";
import { cancelAppointment, rescheduleAppointment } from "@/lib/server/services/appointmentService";
import { createDentalServiceContext } from "@/lib/server/services/shared/accessControl";

export const dynamic = "force-dynamic";

/** POST /api/appointments/[id]/cancel */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { gate, actor } = parseDentalRequest(req);
    const serviceCtx = createDentalServiceContext(gate, actor);
    const { id } = await params;
    const data = await cancelAppointment(serviceCtx, id);
    return jsonOk(data);
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/appointments/[id]/reschedule — body: { day, monthNum, year, time } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { body, ctx: parsed } = await parseDentalJsonBody(req);
    const serviceCtx = createDentalServiceContext(parsed.gate, parsed.actor);
    const { id } = await params;
    const data = await rescheduleAppointment(serviceCtx, id, body);
    return jsonOk(data);
  } catch (e) {
    return handleApiError(e);
  }
}
