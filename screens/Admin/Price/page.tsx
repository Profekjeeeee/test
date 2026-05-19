"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";
import {
  bulkDeleteServices,
  bulkHideServices,
  createService,
  deleteService,
  getServices,
  updateServicePrice,
} from "@/lib/admin/services";
import type { AdminService } from "@/lib/admin/types";
import { tgHapticImpact, tgHapticSuccess } from "@/lib/telegramHaptic";

const DEFAULT_CATEGORY = "Прочее";

const PRESET_CATEGORIES = [
  "Гигиена",
  "Терапия",
  "Хирургия",
  "Имплантология",
  "Ортодонтия",
  DEFAULT_CATEGORY,
] as const;

type NewServiceForm = {
  name: string;
  category: string;
  price: string;
};

const EMPTY_FORM: NewServiceForm = {
  name: "",
  category: DEFAULT_CATEGORY,
  price: "",
};

export default function AdminPricePage() {
  const [services, setServices] = useState<AdminService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Все");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<NewServiceForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await getServices();
    if (err) setError(err);
    else {
      setError("");
      setServices(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set(services.map((s) => s.category));
    return ["Все", ...Array.from(set).sort((a, b) => a.localeCompare(b, "ru"))];
  }, [services]);

  const categoryHints = useMemo(
    () => categories.filter((c) => c !== "Все"),
    [categories]
  );

  const filtered = useMemo(() => {
    if (activeCategory === "Все") return services;
    return services.filter((s) => s.category === activeCategory);
  }, [services, activeCategory]);

  const handlePriceCommit = async (svc: AdminService, raw: string) => {
    const parsed = Number(raw.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    if (parsed === svc.price) return;

    setServices((prev) => prev.map((s) => (s.id === svc.id ? { ...s, price: parsed } : s)));
    const { error: err } = await updateServicePrice(svc.id, parsed);
    if (err) {
      setServices((prev) => prev.map((s) => (s.id === svc.id ? { ...s, price: svc.price } : s)));
      setError(err);
      tgHapticImpact("heavy");
      return;
    }
    tgHapticSuccess();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkHide = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const { error: err } = await bulkHideServices(ids);
    if (err) {
      setError(err);
      return;
    }
    tgHapticSuccess();
    setSelectedIds(new Set());
    await load();
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!window.confirm(`Удалить выбранные услуги (${ids.length})? Это действие нельзя отменить.`)) {
      return;
    }
    const { error: err } = await bulkDeleteServices(ids);
    if (err) {
      setError(err);
      tgHapticImpact("heavy");
      return;
    }
    tgHapticSuccess();
    setSelectedIds(new Set());
    await load();
  };

  const handleDeleteOne = async (svc: AdminService) => {
    if (!window.confirm(`Удалить услугу «${svc.name}»?`)) return;
    tgHapticImpact("light");
    const { error: err } = await deleteService(svc.id);
    if (err) {
      setError(err);
      tgHapticImpact("heavy");
      return;
    }
    tgHapticSuccess();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(svc.id);
      return next;
    });
    await load();
  };

  const openAdd = () => {
    setAddForm({
      ...EMPTY_FORM,
      category: activeCategory !== "Все" ? activeCategory : DEFAULT_CATEGORY,
    });
    setAddOpen(true);
  };

  const handleCreate = async () => {
    const name = addForm.name.trim();
    const category = addForm.category.trim() || DEFAULT_CATEGORY;
    const price = Number(addForm.price.replace(/\s/g, "").replace(",", "."));

    if (!name) {
      setError("Укажите название услуги");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("Укажите корректную цену");
      return;
    }

    setSaving(true);
    setError("");
    const { error: err } = await createService({ name, category, price });
    setSaving(false);

    if (err) {
      setError(err);
      tgHapticImpact("heavy");
      return;
    }

    tgHapticSuccess();
    setAddOpen(false);
    setAddForm(EMPTY_FORM);
    await load();
  };

  return (
    <main className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      <div className="px-5 pt-[calc(env(safe-area-inset-top,0px)+3rem)] pb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-secondary uppercase tracking-widest mb-1">Админ</p>
          <h1 className="text-[22px] font-bold text-[#0F172A] dark:text-white">Прайс</h1>
        </div>
        <ThemeToggleButton sizeClass="w-9 h-9" />
      </div>

      <div className="px-5 pb-2">
        <button
          type="button"
          onClick={openAdd}
          className="interactive-press-sm w-full h-11 rounded-xl bg-primary text-white text-[14px] font-semibold shadow-[0_4px_14px_rgba(36,139,207,0.35)] dark:shadow-none flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path d="M9 3.5V14.5M3.5 9H14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Добавить услугу
        </button>
      </div>

      <div className="px-5 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`interactive-press-sm flex-shrink-0 h-8 px-4 rounded-full text-[13px] font-semibold border ${
              activeCategory === cat
                ? "bg-primary text-white border-primary"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-600"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {selectedIds.size > 0 ? (
        <div className="px-5 pb-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void handleBulkHide()}
            className="interactive-press-sm w-full h-10 rounded-xl border border-primary/30 bg-primary/10 text-primary text-[13px] font-semibold"
          >
            Скрыть выбранные ({selectedIds.size})
          </button>
          <button
            type="button"
            onClick={() => void handleBulkDelete()}
            className="interactive-press-sm w-full h-10 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-[13px] font-semibold"
          >
            Удалить выбранные ({selectedIds.size})
          </button>
        </div>
      ) : null}

      {error ? <p className="px-5 text-[13px] text-red-600 dark:text-red-400 mb-1">{error}</p> : null}

      <div className="px-5 mt-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
        <div className="grid grid-cols-[1fr_80px_72px] gap-2 px-3 py-2.5 bg-surface dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-secondary uppercase">
          <span>Услуга</span>
          <span className="text-right">Цена, ₽</span>
          <span className="text-center">Действия</span>
        </div>

        {loading ? (
          <p className="py-12 text-center text-secondary text-[13px]">Загрузка…</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-secondary text-[13px]">Нет услуг</p>
        ) : (
          filtered.map((svc, idx) => (
            <PriceTableRow
              key={svc.id}
              service={svc}
              selected={selectedIds.has(svc.id)}
              onSelect={() => toggleSelect(svc.id)}
              onDelete={() => void handleDeleteOne(svc)}
              onCommit={(raw) => void handlePriceCommit(svc, raw)}
              showDivider={idx < filtered.length - 1}
            />
          ))
        )}
      </div>

      {addOpen ? (
        <ServiceAddDrawer
          form={addForm}
          saving={saving}
          categoryHints={categoryHints}
          onChange={setAddForm}
          onClose={() => {
            setAddOpen(false);
            setAddForm(EMPTY_FORM);
          }}
          onSave={() => void handleCreate()}
        />
      ) : null}
    </main>
  );
}

function PriceTableRow({
  service,
  selected,
  onSelect,
  onDelete,
  onCommit,
  showDivider,
}: {
  service: AdminService;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onCommit: (raw: string) => void;
  showDivider: boolean;
}) {
  const [draft, setDraft] = useState(String(service.price));

  useEffect(() => {
    setDraft(String(service.price));
  }, [service.price]);

  const commit = () => onCommit(draft);

  return (
    <div
      className={`grid grid-cols-[1fr_80px_72px] gap-2 items-center px-3 py-3 ${
        !service.is_visible ? "opacity-50" : ""
      } ${showDivider ? "border-b border-slate-100 dark:border-slate-800" : ""}`}
    >
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white leading-snug line-clamp-2">
          {service.name}
        </p>
        {!service.is_visible ? (
          <p className="text-[11px] text-secondary mt-0.5">Скрыта в каталоге</p>
        ) : null}
      </div>

      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-surface dark:bg-slate-800 text-right text-[13px] font-bold tabular-nums text-[#0F172A] dark:text-white px-2"
      />

      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onDelete}
          className="interactive-press-sm w-8 h-8 rounded-lg border border-red-500/25 bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400"
          aria-label="Удалить услугу"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path
              d="M2.5 4h9M5.5 4V2.75h3V4M5.25 10.5V6.75M8.75 10.5V6.75M3.75 4l.5 7h5.5l.5-7"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={onSelect}
          className={`interactive-press-sm w-8 h-8 rounded-lg border flex items-center justify-center ${
            selected ? "border-primary bg-primary/15" : "border-slate-200 dark:border-slate-600"
          }`}
          aria-label="Выбрать"
        >
          {selected ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-primary">
              <path d="M2.5 7L5.5 10L11.5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          ) : null}
        </button>
      </div>
    </div>
  );
}

function CategoryField({
  value,
  categoryHints,
  onChange,
}: {
  value: string;
  categoryHints: string[];
  onChange: (category: string) => void;
}) {
  const options = useMemo(() => {
    const set = new Set<string>([...PRESET_CATEGORIES, ...categoryHints]);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [categoryHints]);

  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(() => value.length > 0 && !options.includes(value));

  const displayValue = value.trim() || DEFAULT_CATEGORY;

  const pickCategory = (category: string) => {
    onChange(category);
    setCustomMode(false);
    setOpen(false);
  };

  if (customMode) {
    return (
      <label className="block mb-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[12px] text-secondary font-medium">Категория</span>
          <button
            type="button"
            onClick={() => {
              setCustomMode(false);
              if (!options.includes(displayValue)) onChange(DEFAULT_CATEGORY);
            }}
            className="text-[12px] font-semibold text-primary"
          >
            Из списка
          </button>
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Новая категория"
          autoFocus
          className="mt-0 w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-surface dark:bg-slate-800 text-[14px] text-[#0F172A] dark:text-white"
        />
      </label>
    );
  }

  return (
    <div className="block mb-3">
      <span className="text-[12px] text-secondary font-medium">Категория</span>
      <div className="relative mt-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`interactive-press-sm w-full h-11 px-3 pr-10 rounded-xl border bg-surface dark:bg-slate-800 text-left text-[14px] font-medium text-[#0F172A] dark:text-white flex items-center ${
            open
              ? "border-primary ring-2 ring-primary/20"
              : "border-slate-200 dark:border-slate-600"
          }`}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span className="truncate">{displayValue}</span>
        </button>
        <span
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        {open ? (
          <ul
            role="listbox"
            className="mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-[0_4px_16px_rgba(15,23,42,0.1)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] py-1"
          >
            {options.map((cat) => {
              const selected = cat === displayValue;
              return (
                <li key={cat} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => pickCategory(cat)}
                    className={`interactive-press-sm w-full px-3 py-2.5 text-left text-[14px] flex items-center justify-between gap-2 ${
                      selected
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-[#0F172A] dark:text-white"
                    }`}
                  >
                    <span className="truncate">{cat}</span>
                    {selected ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                        <path
                          d="M2.5 7L5.5 10L11.5 3"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    ) : null}
                  </button>
                </li>
              );
            })}
            <li role="separator" className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <li role="option">
              <button
                type="button"
                onClick={() => {
                  setCustomMode(true);
                  setOpen(false);
                  onChange("");
                }}
                className="interactive-press-sm w-full px-3 py-2.5 text-left text-[14px] text-primary font-semibold"
              >
                Своя категория…
              </button>
            </li>
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function ServiceAddDrawer({
  form,
  saving,
  categoryHints,
  onChange,
  onClose,
  onSave,
}: {
  form: NewServiceForm;
  saving: boolean;
  categoryHints: string[];
  onChange: (f: NewServiceForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-[max(1rem,calc(env(safe-area-inset-bottom,0px)+5.25rem))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-add-title"
    >
      <button
        type="button"
        className="absolute inset-0 border-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        className="relative z-[1] w-full max-w-md max-h-[min(85dvh,calc(100dvh-7rem-env(safe-area-inset-bottom,0px)))] overflow-y-auto rounded-[20px] border border-slate-200 bg-white px-5 pt-4 pb-5 shadow-[0_12px_48px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_12px_48px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto mb-4" />
        <h2
          id="service-add-title"
          className="text-[18px] font-bold text-[#0F172A] dark:text-white mb-4"
        >
          Новая услуга
        </h2>

        <label className="block mb-3">
          <span className="text-[12px] text-secondary font-medium">Название</span>
          <input
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="Например, Профессиональная чистка"
            className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-surface dark:bg-slate-800 text-[14px] text-[#0F172A] dark:text-white"
          />
        </label>

        <CategoryField
          value={form.category}
          categoryHints={categoryHints}
          onChange={(category) => onChange({ ...form, category })}
        />

        <label className="block mb-5">
          <span className="text-[12px] text-secondary font-medium">Цена, ₽</span>
          <input
            type="text"
            inputMode="decimal"
            value={form.price}
            onChange={(e) => onChange({ ...form, price: e.target.value })}
            placeholder="3500"
            className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-surface dark:bg-slate-800 text-[14px] text-[#0F172A] dark:text-white"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="interactive-press-sm flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-600 text-[14px] font-semibold text-[#0F172A] dark:text-white"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="interactive-press-sm flex-1 h-11 rounded-xl bg-primary text-white text-[14px] font-semibold disabled:opacity-60"
          >
            {saving ? "Сохранение…" : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
}
