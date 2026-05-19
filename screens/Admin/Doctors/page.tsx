"use client";

import { useCallback, useEffect, useState } from "react";
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";
import { editDoctor, getDoctors, updateDoctorStatus } from "@/lib/admin/doctors";
import type { AdminDoctor } from "@/lib/admin/types";
import { tgHapticImpact, tgHapticSuccess } from "@/lib/telegramHaptic";

const FILTERS = ["Все", "Терапия", "Хирургия", "Ортодонтия", "Имплантология", "Гигиена"] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "??").toUpperCase();
}

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Все");
  const [editing, setEditing] = useState<AdminDoctor | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await getDoctors();
    if (err) setError(err);
    else {
      setError("");
      setDoctors(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered =
    filter === "Все" ? doctors : doctors.filter((d) => d.specialization === filter);

  const handleToggle = async (doc: AdminDoctor) => {
    const next = !doc.is_active;
    setDoctors((prev) => prev.map((d) => (d.id === doc.id ? { ...d, is_active: next } : d)));
    tgHapticImpact("light");
    const { error: err } = await updateDoctorStatus(doc.id, next);
    if (err) {
      setDoctors((prev) => prev.map((d) => (d.id === doc.id ? { ...d, is_active: doc.is_active } : d)));
      setError(err);
      tgHapticImpact("heavy");
      return;
    }
    tgHapticSuccess();
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const { error: err } = await editDoctor(editing.id, {
      name: editing.name,
      specialization: editing.specialization,
      photo_url: editing.photo_url,
      sort_order: editing.sort_order,
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    tgHapticSuccess();
    setEditing(null);
    await load();
  };

  return (
    <main className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      <div className="px-5 pt-[calc(env(safe-area-inset-top,0px)+3rem)] pb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-secondary uppercase tracking-widest mb-1">Админ</p>
          <h1 className="text-[22px] font-bold text-[#0F172A] dark:text-white">Врачи</h1>
        </div>
        <ThemeToggleButton sizeClass="w-9 h-9" />
      </div>

      <div className="px-5 pb-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`interactive-press-sm flex-shrink-0 h-8 px-4 rounded-full text-[13px] font-semibold border transition-all ${
                filter === f
                  ? "bg-primary text-white border-primary"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-600"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="px-5 text-[13px] text-red-600 dark:text-red-400 mb-2">{error}</p> : null}

      <div className="px-5 grid grid-cols-2 gap-3">
        {loading ? (
          <p className="col-span-2 text-center text-secondary py-12">Загрузка…</p>
        ) : filtered.length === 0 ? (
          <p className="col-span-2 text-center text-secondary py-12">Нет врачей</p>
        ) : (
          filtered.map((doc) => (
            <DoctorGridCard
              key={doc.id}
              doctor={doc}
              onToggle={() => void handleToggle(doc)}
              onOpen={() => setEditing({ ...doc })}
            />
          ))
        )}
      </div>

      {editing ? (
        <DoctorEditDrawer
          doctor={editing}
          saving={saving}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={() => void handleSaveEdit()}
        />
      ) : null}
    </main>
  );
}

function DoctorGridCard({
  doctor,
  onToggle,
  onOpen,
}: {
  doctor: AdminDoctor;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <article
      className={`rounded-2xl border bg-white dark:bg-slate-900 p-3 flex flex-col gap-3 shadow-[0_4px_14px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.32)] ${
        doctor.is_active ? "border-slate-200 dark:border-slate-700" : "border-slate-300/80 opacity-70"
      }`}
    >
      <button type="button" onClick={onOpen} className="text-left flex flex-col items-center gap-2 w-full">
        {doctor.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doctor.photo_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="text-[17px] font-bold text-primary">{initials(doctor.name)}</span>
          </div>
        )}
        <div className="min-w-0 w-full text-center">
          <p className="text-[13px] font-bold text-[#0F172A] dark:text-white leading-tight line-clamp-2">
            {doctor.name}
          </p>
          <p className="text-[11px] text-secondary mt-0.5">{doctor.specialization}</p>
        </div>
      </button>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
        <span className="text-[11px] text-secondary">{doctor.is_active ? "Активен" : "Скрыт"}</span>
        <Toggle checked={doctor.is_active} onChange={onToggle} />
      </div>
    </article>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function DoctorEditDrawer({
  doctor,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  doctor: AdminDoctor;
  saving: boolean;
  onChange: (d: AdminDoctor) => void;
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
      aria-labelledby="doctor-edit-title"
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
          id="doctor-edit-title"
          className="text-[18px] font-bold text-[#0F172A] dark:text-white mb-4"
        >
          Редактирование
        </h2>

        <label className="block mb-3">
          <span className="text-[12px] text-secondary font-medium">ФИО</span>
          <input
            value={doctor.name}
            onChange={(e) => onChange({ ...doctor, name: e.target.value })}
            className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-surface dark:bg-slate-800 text-[14px] text-[#0F172A] dark:text-white"
          />
        </label>

        <label className="block mb-3">
          <span className="text-[12px] text-secondary font-medium">Специализация</span>
          <input
            value={doctor.specialization}
            onChange={(e) => onChange({ ...doctor, specialization: e.target.value })}
            className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-surface dark:bg-slate-800 text-[14px] text-[#0F172A] dark:text-white"
          />
        </label>

        <label className="block mb-3">
          <span className="text-[12px] text-secondary font-medium">URL фото</span>
          <input
            value={doctor.photo_url}
            onChange={(e) => onChange({ ...doctor, photo_url: e.target.value })}
            placeholder="https://..."
            className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-surface dark:bg-slate-800 text-[14px] text-[#0F172A] dark:text-white"
          />
        </label>

        <label className="block mb-5">
          <span className="text-[12px] text-secondary font-medium">Порядок сортировки</span>
          <input
            type="number"
            value={doctor.sort_order}
            onChange={(e) => onChange({ ...doctor, sort_order: Number(e.target.value) || 0 })}
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
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
