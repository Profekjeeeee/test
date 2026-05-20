import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Manrope, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TelegramWebAppProvider } from "@/components/TelegramWebAppProvider";
import PatientAppGate from "@/components/auth/PatientAppGate";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Стоматологическая клиника",
  description: "Личный кабинет пациента",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Дентал",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

const themeBootstrapScript =
  "try{var t=localStorage.getItem('theme');" +
  "if(t==='dark')document.documentElement.classList.add('dark');" +
  "else document.documentElement.classList.remove('dark');}catch(e){}";

/** Ранний фон по themeParams до гидрации React (меньше вспышки в WebView). */
const telegramThemeBootstrapScript =
  "try{var w=window.Telegram&&window.Telegram.WebApp;" +
  "if(w){var p=w.themeParams||{};" +
  "var c=p.bg_color||p.secondary_bg_color;" +
  "if(c){document.documentElement.style.backgroundColor=c;" +
  "if(document.body)document.body.style.backgroundColor=c;}}}" +
  "}catch(e){}";

const TELEGRAM_WEB_APP_SDK = "https://telegram.org/js/telegram-web-app.js";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${manrope.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Анти-FOUC: применяем сохранённую тему до рендера */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="font-sans">
        <Script src={TELEGRAM_WEB_APP_SDK} strategy="beforeInteractive" />
        <script dangerouslySetInnerHTML={{ __html: telegramThemeBootstrapScript }} />
        <TelegramWebAppProvider>
          <ThemeProvider>
            <PatientAppGate>{children}</PatientAppGate>
          </ThemeProvider>
        </TelegramWebAppProvider>
      </body>
    </html>
  );
}
