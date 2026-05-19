"use client";

import { useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";
import Header from "@/components/layout/Header";
import BottomBar from "@/components/layout/BottomBar";

// ── Data ────────────────────────────────────────────────────────────────────

interface PriceItem {
  id: string;
  title: string;
  description: string;
  price: number;
}

interface PriceCategory {
  id: string;
  title: string;
  bookingService: string;
  items: PriceItem[];
}

const DENTAL_PRICES: PriceCategory[] = [
  {
    id: "hygiene",
    title: "Гигиена",
    bookingService: "Профилактика",
    items: [
      {
        id: "h1",
        title: "Профессиональная чистка зубов",
        description: "Удаление зубного камня и налёта ультразвуком",
        price: 3500,
      },
      {
        id: "h2",
        title: "Комплексная чистка AirFlow",
        description: "Пескоструйная обработка для полировки эмали",
        price: 5500,
      },
      {
        id: "h3",
        title: "Чистка AirFlow + ультразвук",
        description: "Комплексная гигиена полости рта",
        price: 7000,
      },
      {
        id: "h4",
        title: "Фторирование зубов",
        description: "Укрепление эмали фторсодержащим составом",
        price: 1500,
      },
      {
        id: "h5",
        title: "Герметизация фиссур (1 зуб)",
        description: "Профилактика кариеса у детей и взрослых",
        price: 2200,
      },
    ],
  },
  {
    id: "therapy",
    title: "Терапия",
    bookingService: "Терапия",
    items: [
      {
        id: "t1",
        title: "Лечение кариеса (1 поверхность)",
        description: "Препарирование и пломбирование зуба",
        price: 4500,
      },
      {
        id: "t2",
        title: "Лечение кариеса (2+ поверхности)",
        description: "Сложная форма, световая пломба",
        price: 7500,
      },
      {
        id: "t3",
        title: "Лечение пульпита (1-канальный)",
        description: "Эндодонтическое лечение корневых каналов",
        price: 12000,
      },
      {
        id: "t4",
        title: "Лечение пульпита (многоканальный)",
        description: "Полное эндодонтическое лечение",
        price: 18000,
      },
      {
        id: "t5",
        title: "Лечение периодонтита",
        description: "Лечение воспалений в области корня зуба",
        price: 14000,
      },
      {
        id: "t6",
        title: "Реставрация зуба",
        description: "Восстановление формы и цвета зуба",
        price: 6500,
      },
      {
        id: "t7",
        title: "Художественная реставрация",
        description: "Эстетическое восстановление передних зубов",
        price: 9500,
      },
    ],
  },
  {
    id: "surgery",
    title: "Хирургия",
    bookingService: "Хирургия",
    items: [
      {
        id: "s1",
        title: "Удаление зуба (простое)",
        description: "Удаление зуба без осложнений",
        price: 3000,
      },
      {
        id: "s2",
        title: "Удаление зуба мудрости",
        description: "Сложное удаление с разрезом десны",
        price: 8000,
      },
      {
        id: "s3",
        title: "Имплантация (Nobel Biocare)",
        description: "Установка имплантата мирового бренда",
        price: 65000,
      },
      {
        id: "s4",
        title: "Синус-лифтинг (закрытый)",
        description: "Наращивание костной ткани верхней челюсти",
        price: 35000,
      },
      {
        id: "s5",
        title: "Кюретаж пародонтальных карманов",
        description: "Удаление отложений под десной",
        price: 5500,
      },
    ],
  },
  {
    id: "orthodontics",
    title: "Ортодонтия",
    bookingService: "Ортодонтия",
    items: [
      {
        id: "o1",
        title: "Консультация ортодонта",
        description: "Первичный осмотр и составление плана лечения",
        price: 1500,
      },
      {
        id: "o2",
        title: "Металлические брекеты (курс)",
        description: "Классическая система выравнивания зубов",
        price: 45000,
      },
      {
        id: "o3",
        title: "Керамические брекеты (курс)",
        description: "Эстетичная система выравнивания",
        price: 70000,
      },
      {
        id: "o4",
        title: "Элайнеры Invisalign (курс)",
        description: "Невидимые съёмные каппы для выравнивания",
        price: 120000,
      },
      {
        id: "o5",
        title: "Ретейнер несъёмный (1 челюсть)",
        description: "Закрепление результата после брекетов",
        price: 6000,
      },
    ],
  },
];

// ── Category icon SVGs ───────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  hygiene: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-primary">
      <path
        d="M3 5.5C3 4 4 3 5.5 3C7 3 7.5 4 8 4C8.5 4 9 3 10.5 3C12 3 13 4 13 5.5C13 7 12 8 11.5 8.5C11.5 8.5 11 11 11 12.5C11 13.5 10.5 14 9.5 14C8.5 14 8 13.5 7.5 12C7 10.5 7.5 9 8 9C8.5 9 9 10.5 8.5 12"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
  therapy: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-primary">
      <path d="M8 2V14M2 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  surgery: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-primary">
      <path
        d="M3 13L13 3M10 3H13V6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 10L3 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  orthodontics: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-primary">
      <rect x="2" y="6" width="12" height="4" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5.5" cy="8" r="1" fill="currentColor" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <circle cx="10.5" cy="8" r="1" fill="currentColor" />
    </svg>
  ),
};

// ── Component ────────────────────────────────────────────────────────────────

export default function PriceListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const adminShell = pathname?.startsWith("/screens/admin") ?? false;
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return DENTAL_PRICES;
    const q = query.toLowerCase();
    return DENTAL_PRICES.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [query]);

  const totalItems = DENTAL_PRICES.reduce((sum, c) => sum + c.items.length, 0);

  const handleBook = (bookingService: string, price: number, itemTitle: string) => {
    router.push(
      `/booking?service=${encodeURIComponent(bookingService)}&price=${price}&itemTitle=${encodeURIComponent(itemTitle)}`
    );
  };

  return (
    <div className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      <Header
        title="Прайс-лист"
        showBack
        rightSlot={adminShell ? <ThemeToggleButton sizeClass="w-9 h-9" /> : undefined}
      />

      {/* Sticky search */}
      <div className="sticky top-14 z-30 bg-surface dark:bg-app-canvas px-5 pt-3 pb-2 border-b border-slate-200 dark:border-slate-700">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <circle cx="7" cy="7" r="4.5" stroke="#9CA3AF" strokeWidth="1.3" />
            <path d="M10.5 10.5L13.5 13.5" stroke="#9CA3AF" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по услугам..."
            className="w-full h-10 pl-9 pr-9 rounded-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-[14px] text-[#0F172A] dark:text-white placeholder-gray-400 outline-none focus:border-primary transition-colors shadow-raised-surface"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-primary">
                <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        {query && (
          <p className="text-[12px] text-gray-400 mt-1.5 px-0.5">
            {filtered.reduce((s, c) => s + c.items.length, 0)} из {totalItems} услуг
          </p>
        )}
      </div>

      <main className="px-5 py-4 flex flex-col gap-4">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[15px] text-gray-400">Услуги не найдены</p>
            <button
              onClick={() => setQuery("")}
              className="mt-2 text-[13px] text-primary font-medium"
            >
              Сбросить поиск
            </button>
          </div>
        ) : (
          filtered.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              onBook={handleBook}
            />
          ))
        )}

        {/* Footer note */}
        <div className="mt-2 px-1">
          <p className="text-[12px] text-gray-400 leading-relaxed text-center">
            Цены указаны в рублях и носят информационный характер.
            Точная стоимость определяется на консультации.
          </p>
        </div>
      </main>

      <BottomBar />
    </div>
  );
}

// ── CategorySection ──────────────────────────────────────────────────────────

function CategorySection({
  category,
  onBook,
}: {
  category: PriceCategory;
  onBook: (service: string, price: number, itemTitle: string) => void;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-700 overflow-hidden shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.32)]">
      {/* Category header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800">
        <div className="w-7 h-7 rounded-[8px] bg-primary/10 flex items-center justify-center flex-shrink-0">
          {CATEGORY_ICONS[category.id]}
        </div>
        <p className="text-[13px] font-bold text-[#0F172A] dark:text-white tracking-tight">
          {category.title}
        </p>
        <span className="ml-auto text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {category.items.length}
        </span>
      </div>

      {/* Items */}
      {category.items.map((item, idx) => (
        <div key={item.id}>
          <PriceRow
            item={item}
            onBook={(price, title) => onBook(category.bookingService, price, title)}
          />
          {idx < category.items.length - 1 && (
            <div className="h-px bg-gray-100 dark:bg-slate-700 mx-4" />
          )}
        </div>
      ))}
    </div>
  );
}

// ── PriceRow ─────────────────────────────────────────────────────────────────

function PriceRow({
  item,
  onBook,
}: {
  item: PriceItem;
  onBook: (price: number, title: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white leading-snug">
          {item.title}
        </p>
        <p className="text-[12px] text-gray-400 dark:text-slate-500 mt-0.5 leading-relaxed">
          {item.description}
        </p>
      </div>

      {/* Price + button */}
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <p className="text-[15px] font-bold text-[#0F172A] dark:text-white tabular-nums whitespace-nowrap">
          {item.price.toLocaleString("ru-RU")} ₽
        </p>
        <button
          type="button"
          onClick={() => onBook(item.price, item.title)}
          className="interactive-press-sm inline-flex h-11 min-h-[44px] min-w-0 shrink-0 items-center justify-center rounded-[8px] border border-primary bg-transparent px-3 text-[12px] font-semibold text-primary transition-colors duration-150 hover:bg-primary-light/80 dark:bg-transparent dark:hover:bg-primary/15 active:bg-primary active:text-white"
        >
          Записаться
        </button>
      </div>
    </div>
  );
}
