import { handleApiError, jsonOk } from "@/lib/server/api/apiResponse";
import { parseDentalJsonBody, parseDentalRequest } from "@/lib/server/api/parseDentalRequest";
import {
  getConsultationAnnotations,
  saveConsultationAnnotation,
  updateConsultationStatus,
  type VideoConsultationStatus,
} from "@/lib/server/services/videoConsultationService";
import { createDentalServiceContext } from "@/lib/server/services/shared/accessControl";

export const dynamic = "force-dynamic";

/** PATCH /api/consultations/[id] — обновить статус или shared file. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { body, ctx: parsed } = await parseDentalJsonBody(req);
    const ctx = createDentalServiceContext(parsed.gate, parsed.actor);
    const { id } = await params;
    const status = body.status as VideoConsultationStatus | undefined;
    const sharedFileId =
      typeof body.sharedFileId === "string" ? body.sharedFileId : undefined;

    if (!status) {
      throw new Error("Нужен status.");
    }

    const data = await updateConsultationStatus(ctx, id, status, { sharedFileId });
    return jsonOk(data);
  } catch (e) {
    return handleApiError(e);
  }
}

/** GET /api/consultations/[id]?annotations=1 — аннотации снимков. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { gate, actor } = parseDentalRequest(req);
    const ctx = createDentalServiceContext(gate, actor);
    const { id } = await params;
    const url = new URL(req.url);

    if (url.searchParams.get("annotations") === "1") {
      const data = await getConsultationAnnotations(ctx, id);
      return jsonOk(data);
    }

    return jsonOk({ id });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/consultations/[id] — сохранить аннотации { fileId, strokes }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { body, ctx: parsed } = await parseDentalJsonBody(req);
    const ctx = createDentalServiceContext(parsed.gate, parsed.actor);
    const { id } = await params;
    const fileId = typeof body.fileId === "string" ? body.fileId : "";
    const strokes = Array.isArray(body.strokes) ? body.strokes : [];

    if (!fileId.trim()) {
      throw new Error("Нужен fileId.");
    }

    const data = await saveConsultationAnnotation(ctx, id, fileId, strokes);
    return jsonOk(data);
  } catch (e) {
    return handleApiError(e);
  }
}
