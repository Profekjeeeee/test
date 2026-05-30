import { withApiHandler } from "@/lib/server/api/apiResponse";
import { checkPlatformAdminFromRequest } from "@/lib/server/requirePlatformAdminApi";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: Request) => {
  const ctx = await checkPlatformAdminFromRequest(req);
  return {
    isPlatformAdmin: Boolean(ctx),
    email: ctx?.email ?? "",
  };
});
