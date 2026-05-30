"use client";

import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import BottomBar from "@/components/layout/BottomBar";
import { useClinic } from "@/contexts/ClinicProvider";

function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits ? `tel:+${digits.startsWith("7") ? digits : `7${digits}`}` : "#";
}

function waHref(whatsapp: string): string {
  const digits = whatsapp.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "#";
}

export default function ContactsPage() {
  const { settings } = useClinic();
  const addressSecondary = [settings.addressLine2, settings.city, settings.postalCode]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      <Header title="Контакты" />

      <main className="px-6 py-4 flex flex-col gap-4">
        <div className="w-full aspect-[390/200] rounded-[16px] bg-gray-100 dark:bg-slate-800 overflow-hidden relative">
          {settings.mapEmbedUrl ? (
            <iframe
              title="Карта клиники"
              src={settings.mapEmbedUrl}
              className="absolute inset-0 w-full h-full border-0"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-[14px] text-gray-400">Карта</p>
            </div>
          )}
        </div>

        <Card>
          <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Адрес
          </p>
          <p className="text-[15px] font-semibold text-[#0F172A] dark:text-white">
            {settings.addressLine1 || "—"}
          </p>
          {addressSecondary ? (
            <p className="text-[13px] text-gray-400 mt-1">{addressSecondary}</p>
          ) : null}
          {settings.metroHint ? (
            <p className="text-[13px] text-primary mt-2 font-medium">{settings.metroHint}</p>
          ) : null}
        </Card>

        <Card>
          <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Режим работы
          </p>
          {settings.workingHours.map((item) => (
            <div
              key={item.day}
              className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-700 last:border-0"
            >
              <p className="text-[14px] text-gray-500">{item.day}</p>
              <p
                className={`text-[14px] font-semibold ${
                  item.hours === "Выходной" ? "text-gray-400" : "text-[#0F172A] dark:text-white"
                }`}
              >
                {item.hours}
              </p>
            </div>
          ))}
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <a
            href={telHref(settings.phone)}
            className="h-12 rounded-[4px] bg-primary text-white text-[14px] font-semibold flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M3 2.5C3 2.5 2.5 5 4 8C5.5 11 8 13.5 11 15C14 16.5 15.5 15.5 15.5 15.5L13.5 12L11.5 13C11.5 13 9.5 11.5 8 10C6.5 8.5 5 6.5 5 6.5L6.5 4.5L3 2.5Z"
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            Позвонить
          </a>
          <a
            href={waHref(settings.whatsapp)}
            className="h-12 rounded-[4px] border border-primary text-primary text-[14px] font-semibold flex items-center justify-center gap-2"
          >
            WhatsApp
          </a>
        </div>
      </main>

      <BottomBar />
    </div>
  );
}
