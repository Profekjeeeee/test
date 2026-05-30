import { withApiHandler } from "@/lib/server/api/apiResponse";
import { parseDentalJsonBody } from "@/lib/server/api/parseDentalRequest";
import { updateClientPersonalProfile } from "@/lib/server/services/clientProfileService";
import { createDentalServiceContext } from "@/lib/server/services/shared/accessControl";

export const dynamic = "force-dynamic";

/** PATCH /api/clients/profile — обновление профиля пациента (только client). */
export const PATCH = withApiHandler(async (req) => {
  const { body, ctx: parsed } = await parseDentalJsonBody(req);
  const ctx = createDentalServiceContext(parsed.gate, parsed.actor);
  return updateClientPersonalProfile(ctx, body);
});
