import { handleApiError, jsonOk } from "@/lib/server/api/apiResponse";
import { ApiError } from "@/lib/server/api/apiError";
import { requirePlatformAdminFromRequest } from "@/lib/server/requirePlatformAdminApi";
import { getPlatformClinic, updatePlatformClinic } from "@/lib/server/platformService";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdminFromRequest(req);
    const { id } = await params;
    const row = await getPlatformClinic(id);
    if (!row) throw new ApiError(404, "Клиника не найдена");
    return jsonOk(row);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdminFromRequest(req);
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const row = await updatePlatformClinic(id, {
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
      planCode: typeof body.planCode === "string" ? body.planCode : undefined,
      subscriptionStatus:
        typeof body.subscriptionStatus === "string"
          ? (body.subscriptionStatus as "trial" | "active" | "past_due" | "cancelled" | "suspended")
          : undefined,
      onboardingStatus:
        typeof body.onboardingStatus === "string"
          ? (body.onboardingStatus as "draft" | "pending" | "completed")
          : undefined,
    });
    return jsonOk(row);
  } catch (e) {
    return handleApiError(e);
  }
}
