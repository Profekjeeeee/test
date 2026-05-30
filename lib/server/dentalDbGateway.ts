import "server-only";

import type { DentalGatewayRequestBody } from "@/lib/dentalGwTypes";
import { apiError } from "@/lib/server/api/apiError";
import {
  authLookupEmployeeClient,
  patchTelegramIdIfEmpty,
  registerClientGateway,
  shadowEnsureActor,
} from "@/lib/server/services/authService";
import {
  cancelAppointment,
  insertAppointment,
  listAppointments,
  rescheduleAppointment,
} from "@/lib/server/services/appointmentService";
import { refreshDentalCaches } from "@/lib/server/services/cacheService";
import {
  deleteChatMessage,
  insertChatMessage,
  listChatMessages,
  updateChatMessage,
} from "@/lib/server/services/chatService";
import {
  fetchClientById,
  selectClientByPatientUuid,
  updateClientFormulaTeeth,
  updateClientInternalNotes,
  updateClientPersonalProfile,
} from "@/lib/server/services/clientProfileService";
import {
  doctorDmPeerMap,
  ensureGeneralRoom,
  fetchRoomMessages,
  findOrCreatePrivateRoom,
  insertRoomMessage,
  pollRooms,
} from "@/lib/server/services/doctorRoomService";
import { resolveClientPkForAppointment } from "@/lib/server/services/patientResolverService";
import { createDentalServiceContext } from "@/lib/server/services/shared/accessControl";
import { verifyDentalGateRequest } from "@/lib/server/dentalGateVerify";

/**
 * @deprecated Используйте REST-эндпоинты `/api/*` и сервисный слой `lib/server/services/*`.
 * Оставлен для обратной совместимости; делегирует в сервисы.
 */
export async function dentalDbGateway(body: DentalGatewayRequestBody): Promise<unknown> {
  const gate = verifyDentalGateRequest(body.telegramInitData);
  const op = typeof body.op === "string" ? body.op.trim() : "";
  if (!op) apiError(400, "Нет операции.");

  const rawPayload = body.payload ?? undefined;
  const payload =
    typeof rawPayload === "object" && rawPayload !== null ? (rawPayload as Record<string, unknown>) : {};
  const ctx = createDentalServiceContext(gate, body.actor ?? null);

  switch (op) {
    case "authLookupEmployeeClient":
      return authLookupEmployeeClient(ctx, typeof payload.cleanPhone === "string" ? payload.cleanPhone : "");
    case "refreshDentalCaches":
      return refreshDentalCaches(ctx);
    case "registerClient":
      return registerClientGateway(ctx, payload);
    case "shadowEnsureActor":
      return shadowEnsureActor(ctx);
    case "patchTelegramIdIfEmpty":
      return patchTelegramIdIfEmpty(
        ctx,
        typeof payload.telegramId === "string" ? payload.telegramId : undefined,
      );
    case "selectClientByPatientUuid":
      return selectClientByPatientUuid(ctx, typeof payload.uuid === "string" ? payload.uuid.trim() : "");
    case "resolveClientPkForAppointment":
      return resolveClientPkForAppointment(ctx, {
        uid: typeof payload.uid === "string" ? payload.uid : null,
        explicitPhone: typeof payload.explicitPhone === "string" ? payload.explicitPhone : null,
      });
    case "appointmentList":
      return listAppointments(ctx);
    case "appointmentInsert":
      return insertAppointment(ctx, payload);
    case "appointmentCancel":
      return cancelAppointment(ctx, typeof payload.id === "string" ? payload.id : "");
    case "appointmentReschedule":
      return rescheduleAppointment(
        ctx,
        typeof payload.id === "string" ? payload.id : "",
        typeof payload.updates === "object" && payload.updates !== null
          ? (payload.updates as Record<string, unknown>)
          : {},
      );
    case "chatListMessages":
      return listChatMessages(ctx, payload.limit);
    case "chatInsertMessage":
      return insertChatMessage(ctx, payload);
    case "doctorEnsureGeneralRoom":
      return ensureGeneralRoom(ctx);
    case "doctorDmPeerMap":
      return doctorDmPeerMap(ctx, typeof payload.selfId === "string" ? payload.selfId : undefined);
    case "doctorFindOrCreatePrivateRoom":
      return findOrCreatePrivateRoom(ctx, typeof payload.peerId === "string" ? payload.peerId : "");
    case "doctorFetchRoomMessages":
      return fetchRoomMessages(ctx, typeof payload.roomId === "string" ? payload.roomId.trim() : "", payload.limit);
    case "doctorInsertRoomMessage":
      return insertRoomMessage(ctx, payload);
    case "doctorPollRooms":
      return pollRooms(ctx, payload.roomIds);
    case "updateClientFormulaTeethById":
      return updateClientFormulaTeeth(
        ctx,
        typeof payload.clientId === "string" ? payload.clientId : "",
        payload.teeth,
      );
    case "updateClientInternalNotes":
      return updateClientInternalNotes(
        ctx,
        typeof payload.clientId === "string" ? payload.clientId : "",
        typeof payload.internalNotes === "string"
          ? payload.internalNotes
          : typeof payload.notes === "string"
            ? payload.notes
            : "",
      );
    case "updateClientPersonalProfile":
      return updateClientPersonalProfile(ctx, payload);
    default:
      apiError(404, `Неизвестная операция: ${op}`);
  }
}

// Re-export для обратной совместимости
export { safeDentalScalarId, telegramMatchesRowTelegram } from "@/lib/server/services/shared/accessControl";
