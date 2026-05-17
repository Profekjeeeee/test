"use client";

import { useState } from "react";

type FeedCategory = "all" | "appointments" | "payments" | "system";

const FEED_ITEMS = [
  {
    id: 1,
    category: "appointments" as FeedCategory,
    icon: "📅",
    title: "Новая запись",
    body: "Морозова К.Г. записалась на чистку к Козловой Е.В. на 15:00",
    time: "2 мин назад",
    unread: true,
  },
  {
    id: 2,
    category: "payments" as FeedCategory,
    icon: "💳",
    title: "Оплата получена",
    body: "Петров Д.М. оплатил счёт №1042 на сумму 12 500 ₽",
    time: "18 мин назад",
    unread: true,
  },
  {
    id: 3,
    category: "appointments" as FeedCategory,
    icon: "🔁",
    title: "Перенос записи",
    body: "Нурмагамбетов Р.А. перенёс визит с 11:00 на 13:30",
    time: "45 мин назад",
    unread: false,
  },
  {
    id: 4,
    category: "system" as FeedCategory,
    icon: "⚙️",
    title: "Обновление расписания",
    body: "Смирнов К.А. добавил 3 свободных слота на пятницу",
    time: "1 ч назад",
    unread: false,
  },
  {
    id: 5,
    category: "appointments" as FeedCategory,
    icon: "❌",
    title: "Отмена записи",
    body: "Александров В.Д. отменил запись на 14:00 — причина: болезнь",
    time: "2 ч назад",
    unread: false,
  },
  {
    id: 6,
    category: "payments" as FeedCategory,
    icon: "⏳",
    title: "Счёт не оплачен",
    body: "Иванова А.С. — счёт №1039 на 8 200 ₽ просрочен на 3 дня",
    time: "3 ч назад",
    unread: false,
  },
  {
    id: 7,
    category: "system" as FeedCategory,
    icon: "👤",
    title: "Новый пациент",
    body: "Зарегистрирован новый пациент — Громова Ю.В.",
    time: "5 ч назад",
    unread: false,
  },
  {
    id: 8,
    category: "payments" as FeedCategory,
    icon: "💳",
    title: "Оплата получена",
    body: "Сидорова Л.П. оплатила счёт №1041 на сумму 6 800 ₽",
    time: "6 ч назад",
    unread: false,
  },
];

const CATEGORIES: { id: FeedCategory; label: string }[] = [
  { id: "all",          label: "Все" },
  { id: "appointments", label: "Записи" },
  { id: "payments",     label: "Оплаты" },
  { id: "system",       label: "Система" },
];

export default function AdminFeedPage() {
  const [activeCategory, setActiveCategory] = useState<FeedCategory>("all");

  const filtered = FEED_ITEMS.filter(
    (item) => activeCategory === "all" || item.category === activeCategory
  );

  const unreadCount = FEED_ITEMS.filter((i) => i.unread).length;

  return (
    <main className="min-h-dvh bg-surface dark:bg-app-canvas pb-[84px]">
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-[24px] font-bold text-[#0F172A] dark:text-white">Лента событий</h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-primary text-white text-[12px] font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        <p className="text-[13px] text-secondary mt-0.5">Активность клиники в реальном времени</p>
      </div>

      {/* Category tabs */}
      <div className="px-5 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`interactive-press-sm shrink-0 px-4 py-2 rounded-xl text-[13px] font-semibold border shadow-raised-surface ${
                activeCategory === cat.id
                  ? "bg-primary text-white border-primary shadow-[0_4px_14px_rgba(36,139,207,0.35)] dark:shadow-none"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed list */}
      <div className="px-5 flex flex-col gap-2">
        {filtered.map((item) => (
          <div
            key={item.id}
            className={`rounded-2xl bg-white dark:bg-slate-900 border p-4 flex gap-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.32)] transition-colors ${
              item.unread
                ? "border-primary/30 dark:border-primary/20"
                : "border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-surface dark:bg-slate-800 flex items-center justify-center shrink-0 text-[20px]">
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className={`text-[13px] font-bold ${item.unread ? "text-[#0F172A] dark:text-white" : "text-[#0F172A] dark:text-slate-300"}`}>
                  {item.title}
                </span>
                {item.unread && (
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                )}
              </div>
              <p className="text-[12px] text-secondary leading-relaxed">{item.body}</p>
              <p className="text-[11px] text-gray-400 dark:text-slate-600 mt-1">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
