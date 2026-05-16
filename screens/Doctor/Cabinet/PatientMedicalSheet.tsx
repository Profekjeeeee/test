"use client";

import { useMemo, useState, useEffect } from "react";
import { getDentalClients } from "@/lib/auth";
import { getAllClinicAppointments, type ClinicAppointment } from "@/lib/appointments";
import { getTreatmentPlanItemsForUser, getItemStatus } from "@/lib/treatmentPlan";
import {
  sortAppointmentsHistoryDesc,
  appointmentStatusLabelRu,
} from "@/lib/doctorSchedule";
import { getPatientTeethState, persistPatientTeeth } from "@/lib/patientTeeth";
import type { ToothCondition, ToothStatus } from "@/types";

const Q1 = [18, 17, 16, 15, 14, 13, 12, 11];
const Q2 = [21, 22, 23, 24, 25, 26, 27, 28];
const Q4 = [48, 47, 46, 45, 44, 43, 42, 41];
const Q3 = [31, 32, 33, 34, 35, 36, 37, 38];

const EDIT_CONDITIONS: { value: ToothCondition; label: string }[] = [
  { value: "healthy", label: "Здоров" },
  { value: "treated", label: "Пломба" },
  { value: "caries", label: "Кариес" },
  { value: "removed", label: "Удалён" },
];

const TOOTH_PATH =
  "M6.5 3C4.5 3 3 4.5 3 7C3 9.5 4.5 11 5.5 12C5.5 12 5 15 5 18C5 20.5 6 21.5 7.5 21.5C9 21.5 10 20.5 10.5 18.5C11 16.5 11.5 13 12 13C12.5 13 13 16.5 13.5 18.5C14 20.5 15 21.5 16.5 21.5C18 21.5 19 20.5 19 18C19 15 18.5 12 18.5 12C19.5 11 21 9.5 21 7C21 4.5 19.5 3 17.5 3C15.5 3 14 4.5 12 4.5C10 4.5 8.5 3 6.5 3Z";

const STRIP: Partial<Record<ToothCondition, { fill: string; stroke: string; dot?: boolean; x?: boolean }>> = {
  healthy: { fill: "none", stroke: "#CBD5E1" },
  treated: { fill: "#E8F6F6", stroke: "#A1D6D7" },
  caries: { fill: "#FEE2E2", stroke: "#F87171", dot: true },
  removed: { fill: "none", stroke: "#CBD5E1", x: true },
  crown: { fill: "#FEF3C7", stroke: "#FBBF24" },
  implant: { fill: "#EDE9FE", stroke: "#A78BFA" },
  prosthesis: { fill: "#F1F5F9", stroke: "#94A3B8" },
};

function DoctorToothGlyph({
  condition,
  flipped,
}: {
  condition: ToothCondition;
  flipped?: boolean;
}) {
  const cfg = STRIP[condition] ?? STRIP.healthy!;
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      overflow="visible"
      style={flipped ? { transform: "scaleY(-1)" } : undefined}
    >
      <path
        d={TOOTH_PATH}
        fill={cfg.fill}
        stroke={cfg.stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {cfg.dot && <ellipse cx="12" cy="7.5" rx="3.2" ry="2.6" fill="#EF4444" opacity={0.88} />}
      {cfg.x && (
        <>
          <line x1="5" y1="3.5" x2="17" y2="11.5" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="17" y1="3.5" x2="5" y2="11.5" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function planPhaseRu(phase: ReturnType<typeof getItemStatus>): string {
  if (phase === "completed") return "Выполнено";
  if (phase === "in-progress") return "В работе";
  return "Запланировано";
}

interface PatientMedicalSheetProps {
  patientId: string;
  onClose: () => void;
}

export default function PatientMedicalSheet({ patientId, onClose }: PatientMedicalSheetProps) {
  const [draftTeeth, setDraftTeeth] = useState<ToothStatus[]>(() => getPatientTeethState(patientId));
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState(false);
  const [aptRev, setAptRev] = useState(0);
  const [clientRev, setClientRev] = useState(0);

  const client = useMemo(
    () => getDentalClients().find((c) => c.id === patientId),
    [patientId, clientRev]
  );

  useEffect(() => {
    setDraftTeeth(getPatientTeethState(patientId));
    setSelectedTooth(null);
    setSavedHint(false);
  }, [patientId]);

  useEffect(() => {
    const bumpApt = () => setAptRev((n) => n + 1);
    const bumpClient = () => setClientRev((n) => n + 1);
    window.addEventListener("appointmentsUpdated", bumpApt);
    window.addEventListener("dentalClientsUpdated", bumpClient);
    return () => {
      window.removeEventListener("appointmentsUpdated", bumpApt);
      window.removeEventListener("dentalClientsUpdated", bumpClient);
    };
  }, []);

  const history = useMemo(() => {
    const all = getAllClinicAppointments().filter((a) => a.patientId === patientId);
    return [...all].sort(sortAppointmentsHistoryDesc);
  }, [patientId, aptRev]);

  const planItems = useMemo(() => getTreatmentPlanItemsForUser(patientId), [patientId]);

  const byNum = useMemo(() => {
    const m = new Map<number, ToothStatus>();
    draftTeeth.forEach((t) => m.set(t.number, t));
    return m;
  }, [draftTeeth]);

  const patientTitle = client ? `${client.lastName} ${client.firstName}`.trim() : "Пациент";
  const phoneLabel = client?.phone ?? "—";

  const handleSaveFormula = async () => {
    setSaving(true);
    try {
      await persistPatientTeeth(patientId, draftTeeth);
      setSavedHint(true);
      window.setTimeout(() => setSavedHint(false), 2200);
    } finally {
      setSaving(false);
    }
  };

  const patchCondition = (num: number, condition: ToothCondition) => {
    setDraftTeeth((prev) =>
      prev.map((t) => (t.number === num ? { ...t, condition } : t))
    );
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-[#F8FAFB] dark:bg-slate-950"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      <header className="shrink-0 px-5 pt-12 pb-4 border-b border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-secondary mb-1">
              Медицинская карта
            </p>
            <h2 className="text-[22px] font-bold text-[#0F172A] dark:text-white leading-tight">{patientTitle}</h2>
            <p className="text-[13px] text-secondary mt-1">
              Телефон: <span className="font-mono text-[#0F172A] dark:text-slate-200">{phoneLabel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl border border-[#E2E8F0] dark:border-slate-700 text-secondary flex items-center justify-center active:scale-95 transition-transform shrink-0"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4 space-y-5 max-w-[480px] mx-auto w-full">
        <section>
          <h3 className="text-[13px] font-bold uppercase tracking-widest text-secondary mb-3">
            История приёмов
          </h3>
          <div className="flex flex-col gap-2">
            {history.length === 0 ? (
              <p className="text-[13px] text-secondary py-4 text-center border border-dashed border-[#E2E8F0] dark:border-slate-700 rounded-2xl">
                Нет записей в базе клиники для этого пациента.
              </p>
            ) : (
              history.map((a: ClinicAppointment) => (
                <div
                  key={`${a.id}-${a.time}-${a.day}`}
                  className="rounded-2xl border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3"
                >
                  <div className="flex justify-between gap-2">
                    <span className="text-[14px] font-semibold text-[#0F172A] dark:text-white">
                      {a.day} {a.month} {a.year}, {a.time}
                    </span>
                    <span className="text-[12px] font-medium px-2 py-0.5 rounded-lg bg-[#F1F5F9] dark:bg-slate-800 text-secondary shrink-0">
                      {appointmentStatusLabelRu(a.status)}
                    </span>
                  </div>
                  <p className="text-[13px] text-secondary mt-1">{a.service}</p>
                  <p className="text-[12px] text-secondary mt-0.5">{a.doctor}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h3 className="text-[13px] font-bold uppercase tracking-widest text-secondary mb-3">
            Текущий план лечения
          </h3>
          <div className="flex flex-col gap-2">
            {planItems.length === 0 ? (
              <p className="text-[13px] text-secondary py-4 text-center border border-dashed border-[#E2E8F0] dark:border-slate-700 rounded-2xl">
                План не заведён.
              </p>
            ) : (
              [...planItems]
                .sort((x, y) => x.date.localeCompare(y.date))
                .map((item) => {
                  const st = getItemStatus(item.date);
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 flex justify-between gap-3"
                    >
                      <div>
                        <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white">{item.title}</p>
                        <p className="text-[12px] text-secondary mt-0.5">
                          {item.category} · {item.date}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-bold text-[#0F172A] dark:text-white">
                          {item.price.toLocaleString("ru-RU")} ₽
                        </p>
                        <p className="text-[11px] font-semibold text-[#A1D6D7] mt-0.5">{planPhaseRu(st)}</p>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="text-[13px] font-bold uppercase tracking-widest text-secondary">
              Зубная формула
            </h3>
            {savedHint && (
              <span className="text-[11px] font-semibold text-[#A1D6D7]">Сохранено</span>
            )}
          </div>

          <p className="text-[12px] text-secondary mb-3 leading-relaxed">
            Нажмите зуб, выберите статус и сохраните — данные попадут в{" "}
            <span className="font-medium text-[#0F172A] dark:text-white">dental_clients</span> и синхронизируются с ЛК
            пациента.
          </p>

          <div className="space-y-2">
            <ToothRow nums={Q1} byNum={byNum} selected={selectedTooth} onPick={setSelectedTooth} />
            <ToothRow nums={Q2} byNum={byNum} selected={selectedTooth} onPick={setSelectedTooth} />
            <ToothRow nums={Q4} byNum={byNum} selected={selectedTooth} onPick={setSelectedTooth} flipped />
            <ToothRow nums={Q3} byNum={byNum} selected={selectedTooth} onPick={setSelectedTooth} flipped />
          </div>

          {selectedTooth !== null && (
            <div className="mt-4 pt-4 border-t border-[#E2E8F0] dark:border-slate-800">
              <p className="text-[11px] font-bold uppercase tracking-widest text-secondary mb-2">
                Зуб {selectedTooth}
              </p>
              <div className="flex flex-wrap gap-2">
                {EDIT_CONDITIONS.map((c) => {
                  const active = byNum.get(selectedTooth)?.condition === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => patchCondition(selectedTooth, c.value)}
                      className={`px-3 py-2 rounded-xl text-[12px] font-semibold border transition-colors active:scale-95 ${
                        active
                          ? "border-[#A1D6D7] bg-[#E8F6F6] dark:bg-[#1A3D3F]/40 text-[#0F172A] dark:text-white"
                          : "border-[#E2E8F0] dark:border-slate-700 text-secondary"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveFormula}
            className="mt-5 w-full h-12 rounded-2xl bg-[#A1D6D7] text-[#0F172A] font-bold text-[15px] active:scale-95 transition-transform disabled:opacity-60"
          >
            Сохранить формулу
          </button>
        </section>
      </div>
    </div>
  );
}

function ToothRow({
  nums,
  byNum,
  selected,
  onPick,
  flipped,
}: {
  nums: number[];
  byNum: Map<number, ToothStatus>;
  selected: number | null;
  onPick: (n: number) => void;
  flipped?: boolean;
}) {
  return (
    <div className="flex justify-between gap-0.5">
      {nums.map((n) => {
        const t = byNum.get(n);
        const condition = t?.condition ?? "healthy";
        const isSel = selected === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            className={`flex-1 min-w-0 max-w-[42px] aspect-[24/32] p-0.5 rounded-lg transition-transform active:scale-95 ${
              isSel ? "ring-2 ring-[#A1D6D7] ring-offset-2 ring-offset-white dark:ring-offset-slate-900" : ""
            }`}
          >
            <DoctorToothGlyph condition={condition} flipped={flipped} />
          </button>
        );
      })}
    </div>
  );
}
