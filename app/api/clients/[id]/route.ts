import { handleApiError, jsonOk } from "@/lib/server/api/apiResponse";
import { parseDentalJsonBody, parseDentalRequest } from "@/lib/server/api/parseDentalRequest";
import {
  fetchClientById,
  updateClientFormulaTeeth,
  updateClientInternalNotes,
} from "@/lib/server/services/clientProfileService";
import { createDentalServiceContext } from "@/lib/server/services/shared/accessControl";

export const dynamic = "force-dynamic";

/** GET /api/clients/[id] */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { gate, actor } = parseDentalRequest(req);
    const ctx = createDentalServiceContext(gate, actor);
    const { id } = await params;
    const data = await fetchClientById(ctx, id);
    return jsonOk(data);
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/clients/[id] — body: { formulaTeeth? } | { internalNotes? } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { body, ctx: parsed } = await parseDentalJsonBody(req);
    const ctx = createDentalServiceContext(parsed.gate, parsed.actor);
    const { id } = await params;

    if ("formulaTeeth" in body || "teeth" in body) {
      const teeth = body.formulaTeeth ?? body.teeth;
      const data = await updateClientFormulaTeeth(ctx, id, teeth);
      return jsonOk(data);
    }

    if ("internalNotes" in body || "notes" in body) {
      const notes =
        typeof body.internalNotes === "string"
          ? body.internalNotes
          : typeof body.notes === "string"
            ? body.notes
            : "";
      const data = await updateClientInternalNotes(ctx, id, notes);
      return jsonOk(data);
    }

    return handleApiError(new Error("Нет полей для обновления."));
  } catch (e) {
    return handleApiError(e);
  }
}
