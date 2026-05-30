"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import BottomBar from "@/components/layout/BottomBar";
import {
  initPatientVisits,
  getPatientVisits,
  formatVisitDate,
  formatVisitPrice,
  formatToothNumbers,
  type PatientVisit,
} from "@/lib/patientVisits";
import {
  initMedicalRecords,
  getMedicalRecords,
  RECORD_TYPE_LABELS,
  SEVERITY_LABELS,
  type MedicalRecord,
} from "@/lib/medicalRecords";
import { ExplainDiagnosisButton } from "@/components/ai/PatientAiAssistant";

function VisitCard({ visit }: { visit: PatientVisit }) {
  const teeth = formatToothNumbers(visit.toothNumbers);

  return (
    <Card padding="sm" className="border border-slate-200/80 dark:border-slate-800">
      <div className="flex justify-between gap-3 items-start">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-secondary uppercase tracking-wide">
            {formatVisitDate(visit.visitDate)}
          </p>
          <p className="text-[16px] font-semibold text-[#0F172A] dark:text-white mt-1 leading-snug">
            {visit.procedureTitle}
          </p>
          {visit.doctorName && (
            <p className="text-[13px] text-secondary mt-1">{visit.doctorName}</p>
          )}
        </div>
        <p className="text-[14px] font-bold text-primary shrink-0 tabular-nums">
          {formatVisitPrice(visit.price)}
        </p>
      </div>

      {visit.diagnosis && (
        <div className="mt-2">
          <p className="text-[13px] text-[#0F172A]/80 dark:text-slate-300 leading-snug">
            <span className="font-semibold text-secondary">Диагноз: </span>
            {visit.diagnosis}
          </p>
          <ExplainDiagnosisButton diagnosis={visit.diagnosis} procedureTitle={visit.procedureTitle} />
        </div>
      )}

      {visit.procedureDescription && (
        <p className="text-[13px] text-secondary mt-1.5 leading-snug">{visit.procedureDescription}</p>
      )}

      {teeth && (
        <p className="text-[12px] font-medium text-primary mt-2">Зубы: {teeth}</p>
      )}

      {visit.materials && (
        <p className="text-[12px] text-secondary mt-1.5">
          <span className="font-semibold">Материалы: </span>
          {visit.materials}
        </p>
      )}
    </Card>
  );
}

function MedicalFactChip({ record }: { record: MedicalRecord }) {
  const severity =
    record.severity && record.recordType === "allergy"
      ? SEVERITY_LABELS[record.severity]
      : null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary-light/50 dark:bg-primary/10 px-3 py-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
          {RECORD_TYPE_LABELS[record.recordType]}
        </span>
        {severity && (
          <span className="text-[10px] font-semibold text-secondary">{severity}</span>
        )}
      </div>
      <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white mt-1">{record.title}</p>
      {record.description && (
        <p className="text-[12px] text-secondary mt-0.5 leading-snug">{record.description}</p>
      )}
    </div>
  );
}

export default function TreatmentHistoryPage() {
  const [visits, setVisits] = useState<PatientVisit[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const sync = () => {
    setVisits(getPatientVisits());
    setRecords(getMedicalRecords());
  };

  useEffect(() => {
    void Promise.all([initPatientVisits(), initMedicalRecords()]).then(() => {
      sync();
      setLoading(false);
    });

    const onUpdate = () => sync();
    window.addEventListener("patientVisitsUpdated", onUpdate);
    window.addEventListener("medicalRecordsUpdated", onUpdate);
    return () => {
      window.removeEventListener("patientVisitsUpdated", onUpdate);
      window.removeEventListener("medicalRecordsUpdated", onUpdate);
    };
  }, []);

  return (
    <div className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      <Header title="История лечения" showBack />

      <main className="px-5 pt-2 pb-28 flex flex-col gap-5 max-w-[480px] mx-auto">
        {records.length > 0 && (
          <section>
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-secondary mb-3">
              Медицинские данные
            </h2>
            <div className="flex flex-col gap-2">
              {records.map((r) => (
                <MedicalFactChip key={r.id} record={r} />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-end justify-between gap-2 mb-3">
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-secondary">
              Проведённые процедуры
            </h2>
            <Link
              href="/formula"
              className="text-[12px] font-semibold text-primary interactive-press-sm"
            >
              Зубная формула →
            </Link>
          </div>

          {loading ? (
            <p className="text-[13px] text-secondary text-center py-8">Загрузка…</p>
          ) : visits.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E2E8F0] dark:border-slate-700 px-4 py-10 text-center">
              <p className="text-[14px] font-medium text-[#0F172A] dark:text-white">
                История пока пуста
              </p>
              <p className="text-[13px] text-secondary mt-2 leading-snug">
                После приёмов врач добавит записи о проведённом лечении — они появятся здесь.
              </p>
              <Link
                href="/booking"
                className="interactive-press-sm inline-flex mt-4 h-10 items-center px-5 rounded-xl bg-primary text-white text-[13px] font-semibold"
              >
                Записаться на приём
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {visits.map((v) => (
                <VisitCard key={v.id} visit={v} />
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomBar />
    </div>
  );
}
