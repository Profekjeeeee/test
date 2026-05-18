/** Контекст вызывающей стороны для шлюза /api/dental-db (соответствует dental_session после входа). */
export interface DentalGwActor {
  role: "client" | "doctor" | "admin";
  id: string;
  phone?: string;
}

export interface DentalGatewayRequestBody {
  op: string;
  payload?: unknown;
  actor?: DentalGwActor | null;
  /** Telegram.WebApp.initData — проверка на сервере с TELEGRAM_BOT_TOKEN. */
  telegramInitData?: string;
}
