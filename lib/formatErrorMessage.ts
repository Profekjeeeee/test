/** Человекочитаемый текст из Error, PostgREST или произвольного throw. */
export function formatErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (err && typeof err === "object") {
    const obj = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [obj.message, obj.details, obj.hint]
      .filter((p): p is string => typeof p === "string" && p.trim() !== "");
    if (parts.length > 0) {
      const code = typeof obj.code === "string" ? obj.code : undefined;
      return code ? `${parts.join(" — ")} [${code}]` : parts.join(" — ");
    }
  }
  if (typeof err === "string" && err.trim()) return err;
  return "Неизвестная ошибка";
}
