import { withApiHandler } from "@/lib/server/api/apiResponse";
import { parseDentalJsonBody } from "@/lib/server/api/parseDentalRequest";
import { resolveClientPkForAppointment } from "@/lib/server/services/patientResolverService";
import { createDentalServiceContext } from "@/lib/server/services/shared/accessControl";

export const dynamic = "force-dynamic";

/** POST /api/clients/resolve — резолв dental_clients.id для записи. */
export const POST = withApiHandler(async (req) => {
  const { body, ctx: parsed } = await parseDentalJsonBody(req);
  const ctx = createDentalServiceContext(parsed.gate, parsed.actor);
  return resolveClientPkForAppointment(ctx, {
    uid: typeof body.uid === "string" ? body.uid : null,
    explicitPhone: typeof body.explicitPhone === "string" ? body.explicitPhone : null,
  });
});
