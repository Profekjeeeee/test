import { withApiHandler } from "@/lib/server/api/apiResponse";
import { loadClinicPublicSettings } from "@/lib/server/clinicService";
import {
  updateClinicSettingsFromRequest,
  type ClinicSettingsPatch,
} from "@/lib/server/clinicSettingsService";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug")?.trim() || undefined;
  return loadClinicPublicSettings(slug);
});

export const PATCH = withApiHandler(async (req: Request) => {
  const body = (await req.json()) as ClinicSettingsPatch;
  return updateClinicSettingsFromRequest(req, body);
});
