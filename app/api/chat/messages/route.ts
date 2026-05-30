import { withApiHandler } from "@/lib/server/api/apiResponse";
import { parseDentalJsonBody, parseDentalRequest } from "@/lib/server/api/parseDentalRequest";
import {
  deleteChatMessage,
  insertChatMessage,
  listChatMessages,
  updateChatMessage,
} from "@/lib/server/services/chatService";
import { createDentalServiceContext } from "@/lib/server/services/shared/accessControl";

export const dynamic = "force-dynamic";

/** GET /api/chat/messages?limit=12000 */
export const GET = withApiHandler(async (req) => {
  const { gate, actor } = parseDentalRequest(req);
  const ctx = createDentalServiceContext(gate, actor);
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  return listChatMessages(ctx, limit);
});

/** POST /api/chat/messages */
export const POST = withApiHandler(async (req) => {
  const { body, ctx: parsed } = await parseDentalJsonBody(req);
  const ctx = createDentalServiceContext(parsed.gate, parsed.actor);
  return insertChatMessage(ctx, body);
});

/** PATCH /api/chat/messages — body: { messageId, text } */
export const PATCH = withApiHandler(async (req) => {
  const { body, ctx: parsed } = await parseDentalJsonBody(req);
  const ctx = createDentalServiceContext(parsed.gate, parsed.actor);
  const messageId = typeof body.messageId === "string" ? body.messageId : "";
  const text = typeof body.text === "string" ? body.text : "";
  return updateChatMessage(ctx, messageId, text);
});

/** DELETE /api/chat/messages?messageId=... */
export const DELETE = withApiHandler(async (req) => {
  const { gate, actor } = parseDentalRequest(req);
  const ctx = createDentalServiceContext(gate, actor);
  const url = new URL(req.url);
  const messageId = url.searchParams.get("messageId") ?? "";
  return deleteChatMessage(ctx, messageId);
});
