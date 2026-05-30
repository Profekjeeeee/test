import { withApiHandler } from "@/lib/server/api/apiResponse";
import { requirePlatformAdminFromRequest } from "@/lib/server/requirePlatformAdminApi";
import {
  createPlatformClinic,
  listPlatformClinics,
} from "@/lib/server/platformService";
import type { CreateClinicInput } from "@/lib/platform/types";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: Request) => {
  await requirePlatformAdminFromRequest(req);
  return listPlatformClinics();
});

export const POST = withApiHandler(async (req: Request) => {
  await requirePlatformAdminFromRequest(req);
  const body = (await req.json()) as CreateClinicInput;
  return createPlatformClinic(body);
});
