export const THEME_STORAGE_KEY = "theme";

/** Синхронизация темы между вкладками и единым обработчиком в ThemeProvider */
export function setThemeDark(dark: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("themeChange", { detail: { dark } }));
}
