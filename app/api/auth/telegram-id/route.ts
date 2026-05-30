import { withApiHandler } from "@/lib/server/api/apiResponse";
import { parseDentalJsonBody } from "@/lib/server/api/parseDentalRequest";
import { patchTelegramIdIfEmpty } from "@/lib/server/services/authService";
import { createDentalServiceContext } from "@/lib/server/services/shared/accessControl";

export const dynamic = "force-dynamic";

/** POST /api/auth/telegram-id — привязка telegram_id если пустой. */
export const POST = withApiHandler(async (req) => {
  const { body, ctx: parsed } = await parseDentalJsonBody(req);
  const ctx = createDentalServiceContext(parsed.gate, parsed.actor);
  return patchTelegramIdIfEmpty(
    ctx,
    typeof body.telegramId === "string" ? body.telegramId : undefined,
  );
});
