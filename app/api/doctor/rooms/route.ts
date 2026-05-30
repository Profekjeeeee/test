import { withApiHandler } from "@/lib/server/api/apiResponse";
import { parseDentalJsonBody, parseDentalRequest } from "@/lib/server/api/parseDentalRequest";
import {
  doctorDmPeerMap,
  ensureGeneralRoom,
  fetchRoomMessages,
  findOrCreatePrivateRoom,
  insertRoomMessage,
  pollRooms,
} from "@/lib/server/services/doctorRoomService";
import { createDentalServiceContext } from "@/lib/server/services/shared/accessControl";

export const dynamic = "force-dynamic";

/** GET /api/doctor/rooms?action=general|dm-map|poll&roomId=&limit=&selfId= */
export const GET = withApiHandler(async (req) => {
  const { gate, actor } = parseDentalRequest(req);
  const ctx = createDentalServiceContext(gate, actor);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "general";

  switch (action) {
    case "general":
      return ensureGeneralRoom(ctx);
    case "dm-map":
      return doctorDmPeerMap(ctx, url.searchParams.get("selfId") ?? undefined);
    case "poll":
      return pollRooms(
        ctx,
        url.searchParams.getAll("roomId").length
          ? url.searchParams.getAll("roomId")
          : undefined,
      );
    case "messages": {
      const roomId = url.searchParams.get("roomId") ?? "";
      const limit = url.searchParams.get("limit");
      return fetchRoomMessages(ctx, roomId, limit ? Number(limit) : undefined);
    }
    default:
      return ensureGeneralRoom(ctx);
  }
});

/** POST /api/doctor/rooms — body: { action, ... } */
export const POST = withApiHandler(async (req) => {
  const { body, ctx: parsed } = await parseDentalJsonBody(req);
  const ctx = createDentalServiceContext(parsed.gate, parsed.actor);
  const action = typeof body.action === "string" ? body.action : "message";

  switch (action) {
    case "private-room":
      return findOrCreatePrivateRoom(ctx, typeof body.peerId === "string" ? body.peerId : "");
    case "message":
      return insertRoomMessage(ctx, body);
    case "poll":
      return pollRooms(ctx, body.roomIds);
    default:
      return insertRoomMessage(ctx, body);
  }
});
