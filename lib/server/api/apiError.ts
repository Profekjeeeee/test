import "server-only";

/** Единый класс ошибок API-слоя (routes + services). */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function apiError(status: number, message: string, code?: string): never {
  throw new ApiError(status, message, code);
}
