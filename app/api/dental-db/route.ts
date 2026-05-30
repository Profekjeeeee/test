import type { DentalGatewayRequestBody } from "@/lib/dentalGwTypes";
import { handleApiError, jsonOk } from "@/lib/server/api/apiResponse";
import { dentalDbGateway } from "@/lib/server/dentalDbGateway";

export const dynamic = "force-dynamic";

/**
 * @deprecated Используйте REST-эндпоинты `/api/appointments`, `/api/chat/messages` и т.д.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DentalGatewayRequestBody;
    const data = await dentalDbGateway(body);
    return jsonOk(data, {
      headers: {
        Deprecation: "true",
        Link: '</api/appointments>; rel="successor-version"',
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
