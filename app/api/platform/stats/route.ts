import { withApiHandler } from "@/lib/server/api/apiResponse";
import { requirePlatformAdminFromRequest } from "@/lib/server/requirePlatformAdminApi";
import { getPlatformStats } from "@/lib/server/platformService";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: Request) => {
  await requirePlatformAdminFromRequest(req);
  return getPlatformStats();
});
