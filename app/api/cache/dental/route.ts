import { withApiHandler } from "@/lib/server/api/apiResponse";
import { parseDentalRequest } from "@/lib/server/api/parseDentalRequest";
import { refreshDentalCaches } from "@/lib/server/services/cacheService";
import { createDentalServiceContext } from "@/lib/server/services/shared/accessControl";

export const dynamic = "force-dynamic";

/** POST /api/cache/dental — обновление кэша clients/employees с ACL по роли. */
export const POST = withApiHandler(async (req) => {
  const { gate, actor } = parseDentalRequest(req);
  const ctx = createDentalServiceContext(gate, actor);
  return refreshDentalCaches(ctx);
});
