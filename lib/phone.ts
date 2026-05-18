/**
 * Единая нормализация и маска РФ: +7 (XXX) XXX-XX-XX, 11 цифр (всегда с ведущей 7).
 */

export const RU_MOBILE_DIGIT_COUNT = 11;

/** Нормализованный «магический» номер админа (11 цифр), совпадает с seed `dental_employees.phone`. */
export const ADMIN_LOGIN_DIGITS = "77777777777";

/** Только цифры; ведущая 8 заменяется на 7 (как в Supabase `phone` у клиентов). */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (digits.length > 0 && !digits.startsWith("7")) digits = "7" + digits;
  return digits.slice(0, RU_MOBILE_DIGIT_COUNT);
}

export function isCompleteRuMobileDigits(digits: string): boolean {
  return (
    digits.length === RU_MOBILE_DIGIT_COUNT &&
    digits.startsWith("7") &&
    /^7\d{10}$/.test(digits)
  );
}

export function isAdminLoginDigits(digits: string): boolean {
  return normalizePhone(digits) === ADMIN_LOGIN_DIGITS;
}

/** Маска отображения при вводе (как в профиле). */
export function formatRuPhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (digits.length > 0 && !digits.startsWith("7")) digits = "7" + digits;
  digits = digits.slice(0, RU_MOBILE_DIGIT_COUNT);
  const d = digits.slice(1);
  let result = "+7";
  if (d.length >= 1) result += ` (${d.slice(0, 3)}`;
  if (d.length >= 4) result += `) ${d.slice(3, 6)}`;
  if (d.length >= 7) result += `-${d.slice(6, 8)}`;
  if (d.length >= 9) result += `-${d.slice(8, 10)}`;
  return result;
}

export function countPhoneDigits(formattedOrRaw: string): number {
  return formattedOrRaw.replace(/\D/g, "").length;
}

/** Паттерн для `.ilike('phone', …)`: совпадение по последним 10 цифрам. */
export function phoneDigitsSuffixPattern(digits: string): string {
  const d = normalizePhone(digits);
  return `%${d.slice(-10)}`;
}
