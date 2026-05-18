/** Дубликат правил телефона из SQL phone_digits_normalized (lib для фильтров чата на сервере). */
export function phoneDigitsNormalizedServer(pRaw: string): string {
  let d = pRaw.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("8")) {
    d = "7" + d.slice(1);
  }
  if (d && !d.startsWith("7")) {
    d = "7" + d;
  }
  return d;
}
