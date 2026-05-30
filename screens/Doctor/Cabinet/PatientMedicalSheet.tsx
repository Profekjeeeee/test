"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  getDentalClients,
  getDentalEmployees,
  getDentalSession,
  fetchDentalClientById,
  updateClientInternalNotes,
  isInternalNotesSchemaMissingError,
  isFormulaTeethSchemaMissingError,
  normalizePhone,
  refreshDentalCaches,
  resolveDentalClientFromCacheSync,
  type DentalClientRecord,
  type DentalEmployeeRecord,
} from "@/lib/auth";
import { findOrCreatePrivateDoctorRoom, sendConsiliumCaseMessage } from "@/lib/doctorOrdinatorskayaChat";
import { getAllClinicAppointments, initAppointments, type ClinicAppointment } from "@/lib/appointments";
import {
  fetchTreatmentPlanItemsForPatient,
  getItemStatus,
  type TreatmentPlanItem,
} from "@/lib/treatmentPlan";
import {
  fetchPatientVisitsForPatient,
  createPatientVisit,
  parseToothNumbersInput,
  formatVisitDate,
  formatVisitPrice,
  formatToothNumbers,
  type PatientVisit,
} from "@/lib/patientVisits";
import {
  fetchMedicalRecordsForPatient,
  createMedicalRecord,
  RECORD_TYPE_LABELS,
  type MedicalRecord,
  type MedicalRecordType,
} from "@/lib/medicalRecords";
import {
  fetchPatientFilesForPatient,
  uploadPatientFile,
  deletePatientFile,
  updatePatientFileVisibility,
  validatePatientFile,
  formatFileDate,
  formatFileSize,
  FILE_CATEGORY_LABELS,
  type PatientFile,
} from "@/lib/patientFiles";
import {
  sortAppointmentsHistoryDesc,
  appointmentStatusLabelRu,
} from "@/lib/doctorSchedule";
import { getPatientTeethState, persistPatientTeeth, sanitizeFormulaTeethForSupabase } from "@/lib/patientTeeth";
import type { ToothCondition, ToothStatus } from "@/types";
import PatientToothFormula from "@/components/dental/PatientToothFormula";
import DoctorAiToolbar from "@/components/ai/DoctorAiToolbar";
import type { ExamDraftResult } from "@/lib/aiAssistant";
import { useToast } from "@/hooks/useToast";
import { Toast } from "@/components/ui/Toast";

function appointmentMatchesPatientCalendarKey(a: ClinicAppointment, rawKey: string): boolean {
  const pid = a.patientId;
  if (!pid) return false;
  if (pid === rawKey) return true;
  const resolved = resolveDentalClientFromCacheSync(rawKey);
  if (resolved && pid === resolved.id) return true;
  const normPid = normalizePhone(String(pid).replace(/\D/g, ""));
  const normKey = normalizePhone(String(rawKey).replace(/\D/g, ""));
  return normPid.length >= 10 && normKey.length >= 10 && normPid === normKey;
}

function planPhaseRu(phase: ReturnType<typeof getItemStatus>): string {
  if (phase === "completed") return "Выполнено";
  if (phase === "in-progress") return "В работе";
  return "Запланировано";
}

interface PatientMedicalSheetProps {
  patientId: string;
  onClose: () => void;
  /** Запись, с которой открыли карту (дата/статус в шапке); иначе берётся последняя по дате из истории. */
  contextAppointment?: ClinicAppointment | null;
}

const INTERNAL_NOTES_DEBOUNCE_MS = 1600;

const DOCTOR_TOOTH_STATUS_MENU: {
  label: string;
  hint?: string;
  condition: ToothCondition;
}[] = [
  { label: "Здоров", hint: "Очистить статус", condition: "healthy" },
  { label: "Кариес", condition: "caries" },
  { label: "Пломба", condition: "treated" },
  { label: "Пульпит", condition: "pulpitis" },
  { label: "Коронка", condition: "crown" },
  { label: "Удален", condition: "removed" },
];

export default function PatientMedicalSheet({
  patientId,
  onClose,
  contextAppointment = null,
}: PatientMedicalSheetProps) {
  const { toastMessage, toastVisible, toastTone, showToast } = useToast();
  const [formulaTeeth, setFormulaTeeth] = useState<ToothStatus[]>([]);
  const [sheetTooth, setSheetTooth] = useState<number | null>(null);

  const [profile, setProfile] = useState<DentalClientRecord | null>(null);
  const [aptRev, setAptRev] = useState(0);
  const [clientRev, setClientRev] = useState(0);

  const [internalNotes, setInternalNotes] = useState("");
  const [internalNotesError, setInternalNotesError] = useState<string | null>(null);
  const [internalNotesPatientMissing, setInternalNotesPatientMissing] = useState(false);
  const [internalNotesNeedsMigration, setInternalNotesNeedsMigration] = useState(false);
  const [internalNotesSaving, setInternalNotesSaving] = useState(false);
  const [internalNotesSavedFlash, setInternalNotesSavedFlash] = useState(false);
  const [consiliumOpen, setConsiliumOpen] = useState(false);
  const [consiliumBusy, setConsiliumBusy] = useState(false);
  const [planItems, setPlanItems] = useState<TreatmentPlanItem[]>([]);
  const [patientVisits, setPatientVisits] = useState<PatientVisit[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [patientFiles, setPatientFiles] = useState<PatientFile[]>([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileDeletingId, setFileDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [visitFormOpen, setVisitFormOpen] = useState(false);
  const [recordFormOpen, setRecordFormOpen] = useState(false);
  const [visitSaving, setVisitSaving] = useState(false);
  const [recordSaving, setRecordSaving] = useState(false);
  const [visitForm, setVisitForm] = useState({
    visitDate: new Date().toISOString().split("T")[0],
    procedureTitle: "",
    procedureDescription: "",
    toothNumbers: "",
    diagnosis: "",
    clinicalNotes: "",
    materials: "",
    price: "",
    visibleToPatient: true,
  });
  const [recordForm, setRecordForm] = useState({
    recordType: "allergy" as MedicalRecordType,
    title: "",
    description: "",
    visibleToPatient: true,
  });
  const internalNotesPersistedRef = useRef<string | undefined>(undefined);
  const internalNotesEditedRef = useRef(false);
  const internalNotesNeedsMigrationRef = useRef(false);
  const internalNotesResolvableRef = useRef(false);
  const internalNotesRef = useRef(internalNotes);
  internalNotesRef.current = internalNotes;

  const client = useMemo(() => {
    return (
      resolveDentalClientFromCacheSync(patientId) ??
      getDentalClients().find((c) => c.id === patientId.trim())
    );
  }, [patientId, clientRev]);

  /** Приоритет: строка из Supabase по UUID; иначе кэш (legacy). Телефон только из объекта, не из id. */
  const displayClient = profile ?? client;

  const canonicalPatientId = useMemo(
    () => (profile?.id ?? patientId).trim(),
    [profile?.id, patientId]
  );

  useEffect(() => {
    internalNotesNeedsMigrationRef.current = internalNotesNeedsMigration;
  }, [internalNotesNeedsMigration]);

  useEffect(() => {
    let cancelled = false;
    internalNotesPersistedRef.current = undefined;
    internalNotesEditedRef.current = false;
    internalNotesResolvableRef.current = false;
    setInternalNotes("");
    setInternalNotesError(null);
    setInternalNotesPatientMissing(false);
    setInternalNotesNeedsMigration(false);
    setInternalNotesSavedFlash(false);
    setProfile(null);

    const trimmed = patientId.trim();
    if (!trimmed) {
      return;
    }

    void (async () => {
      try {
        const { client: row, internalNotesSchemaMissing } = await fetchDentalClientById(trimmed);
        if (cancelled) return;
        setProfile(row);
        internalNotesResolvableRef.current = !!row;
        internalNotesPersistedRef.current =
          typeof row?.internalNotes === "string" ? row.internalNotes : "";
        setInternalNotesNeedsMigration(internalNotesSchemaMissing);
        setInternalNotesPatientMissing(!row);
        setInternalNotesError(null);
        if (!internalNotesEditedRef.current) {
          setInternalNotes(internalNotesPersistedRef.current);
        }
      } catch (err) {
        console.error("[PatientMedicalSheet] dental_clients load:", err);
        if (!cancelled) {
          internalNotesResolvableRef.current = false;
          setProfile(null);
          setInternalNotesPatientMissing(false);
          setInternalNotesError("Не удалось загрузить данные пациента");
          internalNotesPersistedRef.current = "";
          setInternalNotes("");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  useEffect(() => {
    if (internalNotesNeedsMigration) return;
    if (!internalNotesResolvableRef.current) return;
    if (internalNotesPersistedRef.current === undefined) return;
    if (internalNotes === internalNotesPersistedRef.current) return;

    const tid = window.setTimeout(() => {
      void (async () => {
        try {
          setInternalNotesSaving(true);
          await updateClientInternalNotes(canonicalPatientId, internalNotes);
          internalNotesPersistedRef.current = internalNotes;
          setInternalNotesError(null);
          setInternalNotesNeedsMigration(false);
          setInternalNotesSavedFlash(true);
          window.setTimeout(() => setInternalNotesSavedFlash(false), 1800);
        } catch (err) {
          if (isInternalNotesSchemaMissingError(err)) {
            setInternalNotesNeedsMigration(true);
            setInternalNotesError(null);
          } else {
            console.error("[PatientMedicalSheet] internal_notes save:", err);
            setInternalNotesError("Не удалось сохранить заметку");
          }
        } finally {
          setInternalNotesSaving(false);
        }
      })();
    }, INTERNAL_NOTES_DEBOUNCE_MS);

    return () => window.clearTimeout(tid);
  }, [internalNotes, canonicalPatientId, internalNotesNeedsMigration]);

  useEffect(() => {
    const id = canonicalPatientId;
    return () => {
      const latest = internalNotesRef.current;
      const persisted = internalNotesPersistedRef.current;
      if (
        persisted !== undefined &&
        latest !== persisted &&
        internalNotesResolvableRef.current &&
        !internalNotesNeedsMigrationRef.current
      ) {
        void updateClientInternalNotes(id, latest).catch((e) => {
          if (!isInternalNotesSchemaMissingError(e)) {
            console.error("[PatientMedicalSheet] internal_notes flush:", e);
          }
        });
      }
    };
  }, [canonicalPatientId]);

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

  useEffect(() => {
    const baseline =
      profile?.formulaTeeth && profile.formulaTeeth.length >= 32
        ? sanitizeFormulaTeethForSupabase(profile.formulaTeeth as ToothStatus[])
        : getPatientTeethState((profile?.id ?? patientId).trim());
    setFormulaTeeth(baseline);
  }, [patientId, profile?.id, profile?.formulaTeeth, clientRev]);

  const history = useMemo(() => {
    const all = getAllClinicAppointments().filter((a) =>
      appointmentMatchesPatientCalendarKey(a, patientId)
    );
    return [...all].sort(sortAppointmentsHistoryDesc);
  }, [patientId, aptRev]);

  const headerAppointment = useMemo(() => {
    if (
      contextAppointment &&
      appointmentMatchesPatientCalendarKey(contextAppointment, patientId)
    ) {
      return contextAppointment;
    }
    return history[0] ?? null;
  }, [contextAppointment, patientId, history]);

  useEffect(() => {
    let cancelled = false;
    const key = canonicalPatientId;
    const sync = resolveDentalClientFromCacheSync(patientId);

    void (async () => {
      const primary = await fetchTreatmentPlanItemsForPatient(key);
      if (cancelled) return;

      if (!sync || sync.id === patientId.trim()) {
        setPlanItems(primary);
        return;
      }

      const secondary = await fetchTreatmentPlanItemsForPatient(sync.id);
      if (cancelled) return;

      const ids = new Set(primary.map((i) => i.id));
      setPlanItems([...primary, ...secondary.filter((i) => !ids.has(i.id))]);
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, canonicalPatientId]);

  useEffect(() => {
    let cancelled = false;
    const key = canonicalPatientId;

    void (async () => {
      const [visits, records, files] = await Promise.all([
        fetchPatientVisitsForPatient(key, true),
        fetchMedicalRecordsForPatient(key, true),
        fetchPatientFilesForPatient(key, true),
      ]);
      if (cancelled) return;
      setPatientVisits(visits);
      setMedicalRecords(records);
      setPatientFiles(files);
    })();

    return () => {
      cancelled = true;
    };
  }, [canonicalPatientId]);

  useEffect(() => {
    if (!visitFormOpen) return;
    const apt = headerAppointment;
    if (!apt) return;
    const y = apt.year;
    const monthIdx = [
      "января", "февраля", "марта", "апреля", "мая", "июня",
      "июля", "августа", "сентября", "октября", "ноября", "декабря",
    ].indexOf(apt.month.toLowerCase());
    if (monthIdx >= 0) {
      const iso = `${y}-${String(monthIdx + 1).padStart(2, "0")}-${String(apt.day).padStart(2, "0")}`;
      setVisitForm((f) => ({ ...f, visitDate: iso }));
    }
  }, [visitFormOpen, headerAppointment]);

  const submitVisitForm = async () => {
    const title = visitForm.procedureTitle.trim();
    if (!title) {
      showToast("Укажите название процедуры", "error");
      return;
    }
    setVisitSaving(true);
    try {
      const created = await createPatientVisit({
        patientId: canonicalPatientId,
        visitDate: visitForm.visitDate,
        procedureTitle: title,
        procedureDescription: visitForm.procedureDescription,
        toothNumbers: parseToothNumbersInput(visitForm.toothNumbers),
        diagnosis: visitForm.diagnosis,
        clinicalNotes: visitForm.clinicalNotes,
        materials: visitForm.materials,
        price: visitForm.price ? Number(visitForm.price) : null,
        appointmentId: headerAppointment?.id,
        visibleToPatient: visitForm.visibleToPatient,
      });
      if (!created) {
        showToast("Не удалось сохранить запись", "error");
        return;
      }
      const refreshed = await fetchPatientVisitsForPatient(canonicalPatientId, true);
      setPatientVisits(refreshed);
      setVisitFormOpen(false);
      setVisitForm({
        visitDate: new Date().toISOString().split("T")[0],
        procedureTitle: "",
        procedureDescription: "",
        toothNumbers: "",
        diagnosis: "",
        clinicalNotes: "",
        materials: "",
        price: "",
        visibleToPatient: true,
      });
      showToast("Запись о лечении добавлена");
    } finally {
      setVisitSaving(false);
    }
  };

  const submitRecordForm = async () => {
    const title = recordForm.title.trim();
    if (!title) {
      showToast("Укажите название", "error");
      return;
    }
    setRecordSaving(true);
    try {
      const created = await createMedicalRecord({
        patientId: canonicalPatientId,
        recordType: recordForm.recordType,
        title,
        description: recordForm.description,
        visibleToPatient: recordForm.visibleToPatient,
      });
      if (!created) {
        showToast("Не удалось сохранить мед. запись", "error");
        return;
      }
      const refreshed = await fetchMedicalRecordsForPatient(canonicalPatientId, true);
      setMedicalRecords(refreshed);
      setRecordFormOpen(false);
      setRecordForm({
        recordType: "allergy",
        title: "",
        description: "",
        visibleToPatient: true,
      });
      showToast("Мед. запись добавлена");
    } finally {
      setRecordSaving(false);
    }
  };

  const patientTitle = displayClient
    ? `${displayClient.lastName} ${displayClient.firstName}`.trim()
    : "Пациент";
  const phoneLabel = displayClient?.phone ?? "—";

  const consiliumColleagues = useMemo(() => {
    const me = getDentalSession()?.id;
    return getDentalEmployees()
      .filter((e) => e.role === "doctor" && (!me || e.id !== me))
      .slice()
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
  }, [clientRev, consiliumOpen]);

  const canEditFormula = Boolean(profile?.id);

  const sendConsiliumTo = async (doc: DentalEmployeeRecord) => {
    setConsiliumBusy(true);
    try {
      await refreshDentalCaches();
      const sess = getDentalSession();
      if (!sess?.id || sess.role !== "doctor") {
        showToast("Консилиум доступен только врачам", "error");
        return;
      }
      const { roomId, error: roomErr } = await findOrCreatePrivateDoctorRoom(sess.id, doc.id);
      if (roomErr || !roomId) {
        showToast(roomErr ?? "Не удалось открыть чат с коллегой", "error");
        return;
      }
      const nameForCase =
        patientTitle.trim() && patientTitle !== "Пациент"
          ? patientTitle.trim()
          : displayClient
            ? `${displayClient.lastName} ${displayClient.firstName}`.trim() || "Пациент"
            : "Пациент";
      const { error: sendErr } = await sendConsiliumCaseMessage({
        roomId,
        senderId: sess.id,
        senderName: sess.fullName,
        patientId: canonicalPatientId,
        patientName: nameForCase,
        formulaTeeth,
      });
      if (sendErr) {
        showToast(sendErr, "error");
        return;
      }
      showToast("Случай направлен коллеге");
      setConsiliumOpen(false);
    } finally {
      setConsiliumBusy(false);
    }
  };

  const handleDoctorToothClick = (toothNum: number) => {
    if (!canEditFormula) {
      showToast("Дождитесь загрузки карточки пациента в базе", "error");
      return;
    }
    setSheetTooth(toothNum);
  };

  const closeToothSheet = () => setSheetTooth(null);

  const copyPatientId = async () => {
    const id = canonicalPatientId;
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      showToast("ID скопирован");
    } catch {
      showToast("Не удалось скопировать ID", "error");
    }
  };

  const applyDoctorToothCondition = async (condition: ToothCondition) => {
    if (sheetTooth === null || !canEditFormula) return;
    const snapshotTeeth = formulaTeeth;
    const snapshotProfile = profile;
    const next = snapshotTeeth.map((t) => (t.number === sheetTooth ? { ...t, condition } : t));
    setSheetTooth(null);
    setFormulaTeeth(next);
    setProfile((p) => (p ? { ...p, formulaTeeth: next } : null));
    try {
      await persistPatientTeeth(canonicalPatientId, next);
      showToast("Статус зуба сохранён");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[PatientMedicalSheet] formula save:", msg, e);
      setFormulaTeeth(snapshotTeeth);
      setProfile(snapshotProfile);
      if (isFormulaTeethSchemaMissingError(e)) {
        showToast(
          "В Supabase нет колонки formula_teeth. Выполни миграцию 006_dental_clients_formula_teeth.sql",
          "error"
        );
      } else {
        showToast(`Не удалось сохранить формулу: ${msg}`, "error");
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-surface dark:bg-app-canvas"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      <header className="shrink-0 w-full max-w-full box-border px-3 pt-[max(8px,calc(env(safe-area-inset-top)+6px))] pb-2 overflow-hidden bg-surface dark:bg-app-canvas">
        <div className="relative rounded-xl border border-primary/20 dark:border-primary/30 bg-[#F0F7FD]/90 dark:bg-primary/10 px-3 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="interactive-press-sm absolute top-2 right-2 z-[1] h-11 w-11 rounded-lg border border-primary/20 dark:border-primary/35 bg-white/90 dark:bg-slate-900/90 text-secondary flex items-center justify-center"
            aria-label="Закрыть"
          >
            ✕
          </button>
          <div className="grid grid-cols-2 gap-2 gap-y-1 min-w-0 pr-[52px]">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-secondary mb-0.5">Карта</p>
              <p className="text-[15px] font-semibold text-[#0F172A] dark:text-white leading-snug break-words">
                {patientTitle}
              </p>
              <p className="text-xs text-secondary mt-0.5 leading-snug">
                <span className="font-mono text-[#0F172A]/85 dark:text-slate-200 break-all">{phoneLabel}</span>
              </p>
            </div>
            <div className="min-w-0 flex flex-col items-end text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-secondary mb-0.5">Приём</p>
              {headerAppointment ? (
                <>
                  <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white leading-snug">
                    {headerAppointment.day} {headerAppointment.month} {headerAppointment.year}
                  </p>
                  <p className="text-xs text-secondary mt-0.5 tabular-nums">{headerAppointment.time}</p>
                  <span className="mt-1 inline-flex max-w-full truncate rounded-md border border-primary/25 bg-white/80 dark:bg-slate-900/60 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {appointmentStatusLabelRu(headerAppointment.status)}
                  </span>
                </>
              ) : (
                <p className="text-xs text-secondary leading-snug">Нет записей в календаре</p>
              )}
            </div>
          </div>
          {canonicalPatientId ? (
            <div className="mt-2 flex items-center gap-1.5 border-t border-primary/15 pt-2 min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-secondary shrink-0">ID</span>
              <span
                className="truncate text-xs font-mono text-secondary/80 dark:text-secondary min-w-0 flex-1"
                title={canonicalPatientId}
              >
                {canonicalPatientId.length > 8
                  ? `${canonicalPatientId.slice(0, 8)}…`
                  : canonicalPatientId}
              </span>
              <button
                type="button"
                onClick={() => void copyPatientId()}
                className="interactive-press-sm shrink-0 flex h-11 w-11 items-center justify-center rounded-lg border border-primary/25 bg-white dark:bg-slate-900 text-primary"
                aria-label="Скопировать полный ID"
                title="Скопировать полный ID"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M8 7V5.2C8 4.0799 8 3.51984 8.21799 3.09202C8.40973 2.71569 8.71569 2.40973 9.09202 2.21799C9.51984 2 10.0799 2 11.2 2H18.8C19.9201 2 20.4802 2 20.908 2.21799C21.2843 2.40973 21.5903 2.71569 21.782 3.09202C22 3.51984 22 4.0799 22 5.2V12.8C22 13.9201 22 14.4802 21.782 14.908C21.5903 15.2843 21.2843 15.5903 20.908 15.782C20.4802 16 19.9201 16 18.8 16H17M11.2 22H5.2C4.07989 22 3.51984 22 3.09202 21.782C2.71569 21.5903 2.40973 21.2843 2.21799 20.908C2 20.4802 2 19.9201 2 18.8V12.2C2 11.0799 2 10.5198 2.21799 10.092C2.40973 9.71569 2.71569 9.40973 3.09202 9.21799C3.51984 9 4.0799 9 5.2 9H11.2C12.3201 9 12.8802 9 13.308 9.21799C13.6843 9.40973 13.9903 9.71569 14.182 10.092C14.4 10.5198 14.4 11.0799 14.4 12.2V18.8C14.4 19.9201 14.4 20.4802 14.182 20.908C13.9903 21.2843 13.6843 21.5903 13.308 21.782C12.8802 22 12.3201 22 11.2 22Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4 space-y-6 max-w-[480px] mx-auto w-full">
        {canonicalPatientId ? (
          <DoctorAiToolbar
            patientId={canonicalPatientId}
            examBriefNotes={
              visitFormOpen
                ? [visitForm.procedureTitle, visitForm.diagnosis, visitForm.procedureDescription]
                    .filter(Boolean)
                    .join(". ") || internalNotes
                : internalNotes
            }
            examToothNumbers={visitFormOpen ? visitForm.toothNumbers : undefined}
            onApplyExamDraft={(draft: ExamDraftResult) => {
              setVisitForm((f) => ({
                ...f,
                procedureTitle: draft.procedureTitle || f.procedureTitle,
                procedureDescription: draft.procedureDescription || f.procedureDescription,
                diagnosis: draft.diagnosis || f.diagnosis,
                clinicalNotes: draft.clinicalNotes || f.clinicalNotes,
                materials: draft.materials || f.materials,
              }));
              setVisitFormOpen(true);
              showToast("Черновик применён к форме", "success");
            }}
          />
        ) : null}

        <section className="rounded-2xl border border-primary/25 bg-[#F0F7FD] dark:bg-primary/15 dark:border-primary/35 p-4 shadow-[0_4px_14px_rgba(36,139,207,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.28)]">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h3 className="text-[13px] font-bold uppercase tracking-widest text-primary">
                Зубная формула пациента
              </h3>
              <p className="text-[11px] text-secondary leading-snug mt-1">
                Нажмите зуб, чтобы задать статус — данные сохраняются в Supabase и синхронизируются с ЛК пациента.
              </p>
            </div>
          </div>
          <div className="-mx-1">
            <PatientToothFormula
              teeth={formulaTeeth}
              readOnly={false}
              selectedTooth={sheetTooth}
              onToothClick={handleDoctorToothClick}
              variant="card"
            />
          </div>
          <button
            type="button"
            disabled={!canEditFormula || consiliumBusy}
            onClick={() => setConsiliumOpen(true)}
            className="mt-4 w-full flex items-center justify-center gap-2.5 h-12 rounded-2xl border-2 border-primary/35 bg-white dark:bg-slate-900 text-primary text-[14px] font-semibold shadow-[0_4px_16px_rgba(36,139,207,0.12)] interactive-press-sm disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M9 14L4 9M4 9L9 4M4 9H14.5C17.5376 9 20 11.4624 20 14.5V16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Проконсультироваться с коллегой
          </button>
        </section>

        <section className="rounded-2xl border border-primary/25 bg-[#F0F7FD] dark:bg-primary/15 dark:border-primary/35 p-4 shadow-[0_4px_14px_rgba(36,139,207,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.28)]">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-[13px] font-bold uppercase tracking-widest text-primary">
              Внутренние заметки (видимо только персоналу)
            </h3>
            <div className="flex items-center gap-2 shrink-0 min-h-[18px]">
              {internalNotesSaving && (
                <span className="text-[11px] font-semibold text-primary/80">Сохранение…</span>
              )}
              {!internalNotesSaving && internalNotesSavedFlash && (
                <span className="text-[11px] font-semibold text-primary">Сохранено</span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-secondary leading-snug mb-3">
            Не показываются пациенту в приложении. Используйте для нюансов приёма и коммуникации.
          </p>
          <textarea
            value={internalNotes}
            onChange={(e) => {
              internalNotesEditedRef.current = true;
              setInternalNotes(e.target.value);
            }}
            placeholder="Например: боится уколов, повышенный рвотный рефлекс, любит рыбалку..."
            rows={4}
            className="w-full resize-y min-h-[96px] rounded-xl border border-primary/25 bg-white dark:bg-slate-900 px-3 py-2.5 text-[13px] text-[#0F172A] dark:text-slate-100 placeholder:text-secondary/70 outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-shadow"
          />
          {internalNotesNeedsMigration && (
            <p className="text-[12px] font-medium text-primary mt-2 leading-snug">
              Колонки ещё нет в облачной БД. Открой Supabase → SQL Editor и выполни:{" "}
              <span className="font-mono text-[11px] opacity-90">
                ALTER TABLE public.dental_clients ADD COLUMN IF NOT EXISTS internal_notes text;
              </span>{" "}
              файл миграции:{" "}
              <span className="font-mono text-[11px]">supabase/migrations/005_dental_clients_internal_notes.sql</span>
            </p>
          )}
          {internalNotesPatientMissing && (
            <p className="text-[12px] font-medium text-primary mt-2 leading-snug">
              Нет карточки в dental_clients для этого ключа записи или номер не совпадает. После регистрации пациента и
              записи с реальным client_id данные подтянутся автоматически.
            </p>
          )}
          {internalNotesError && (
            <p className="text-[12px] font-medium text-red-600 dark:text-red-400 mt-2">{internalNotesError}</p>
          )}
        </section>

        <section className="rounded-2xl border border-primary/25 bg-[#F0F7FD] dark:bg-primary/15 dark:border-primary/35 p-4 shadow-[0_4px_14px_rgba(36,139,207,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.28)]">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="text-[13px] font-bold uppercase tracking-widest text-primary">
              Мед. данные пациента
            </h3>
            <button
              type="button"
              onClick={() => setRecordFormOpen(true)}
              className="interactive-press-sm shrink-0 text-[12px] font-semibold text-primary px-2 py-1 rounded-lg border border-primary/30 bg-white/80 dark:bg-slate-900"
            >
              + Добавить
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {medicalRecords.length === 0 ? (
              <p className="text-[12px] text-secondary py-2">Аллергии и противопоказания не указаны.</p>
            ) : (
              medicalRecords.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-primary/15 bg-white/90 dark:bg-slate-900/80 px-3 py-2.5"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    {RECORD_TYPE_LABELS[r.recordType]}
                    {!r.visibleToPatient && (
                      <span className="ml-2 text-secondary normal-case tracking-normal font-semibold">
                        · только персонал
                      </span>
                    )}
                  </p>
                  <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white mt-0.5">{r.title}</p>
                  {r.description && (
                    <p className="text-[12px] text-secondary mt-0.5 leading-snug">{r.description}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_14px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.28)]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-[13px] font-bold uppercase tracking-widest text-secondary">
              Файлы и снимки
            </h3>
            <button
              type="button"
              disabled={fileUploading}
              onClick={() => fileInputRef.current?.click()}
              className="interactive-press-sm shrink-0 text-[12px] font-semibold text-primary px-2.5 py-1 rounded-lg border border-primary/30 bg-primary-light/60 dark:bg-primary/10 disabled:opacity-50"
            >
              {fileUploading ? "Загрузка…" : "+ Файл"}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const err = validatePatientFile(file);
              if (err) {
                showToast(err, "error");
                return;
              }
              setFileUploading(true);
              void uploadPatientFile({
                patientId: canonicalPatientId,
                file,
                fileCategory: file.type.startsWith("image/") ? "xray" : "document",
              })
                .then(async (created) => {
                  if (!created) {
                    showToast("Не удалось загрузить файл", "error");
                    return;
                  }
                  const refreshed = await fetchPatientFilesForPatient(canonicalPatientId, true);
                  setPatientFiles(refreshed);
                  showToast("Файл загружен", "success");
                })
                .finally(() => setFileUploading(false));
            }}
          />
          <p className="text-[11px] text-secondary mb-3">JPG, PNG, PDF — до 10 МБ</p>
          <div className="flex flex-col gap-2">
            {patientFiles.length === 0 ? (
              <p className="text-[12px] text-secondary py-2">Снимки и документы не прикреплены.</p>
            ) : (
              patientFiles.map((f) => (
                <div
                  key={f.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 flex gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      {FILE_CATEGORY_LABELS[f.fileCategory]}
                      {!f.visibleToPatient && (
                        <span className="ml-2 text-secondary normal-case tracking-normal font-semibold">
                          · скрыто от пациента
                        </span>
                      )}
                    </p>
                    <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate">
                      {f.fileName}
                    </p>
                    <p className="text-[11px] text-secondary mt-0.5">
                      {formatFileDate(f.createdAt)} · {formatFileSize(f.fileSize)}
                    </p>
                    {f.signedUrl && (
                      <a
                        href={f.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-primary mt-1 inline-block"
                      >
                        Открыть →
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      className="text-[10px] font-semibold text-primary px-1"
                      onClick={() => {
                        void updatePatientFileVisibility(f.id, !f.visibleToPatient).then(
                          async (ok) => {
                            if (!ok) {
                              showToast("Не удалось обновить видимость", "error");
                              return;
                            }
                            const refreshed = await fetchPatientFilesForPatient(
                              canonicalPatientId,
                              true
                            );
                            setPatientFiles(refreshed);
                          }
                        );
                      }}
                    >
                      {f.visibleToPatient ? "Скрыть" : "Показать"}
                    </button>
                    <button
                      type="button"
                      disabled={fileDeletingId === f.id}
                      className="text-[10px] font-semibold text-[#EF4444] px-1 disabled:opacity-50"
                      onClick={() => {
                        setFileDeletingId(f.id);
                        void deletePatientFile(f.id)
                          .then(async (ok) => {
                            if (!ok) {
                              showToast("Не удалось удалить", "error");
                              return;
                            }
                            const refreshed = await fetchPatientFilesForPatient(
                              canonicalPatientId,
                              true
                            );
                            setPatientFiles(refreshed);
                            showToast("Файл удалён", "success");
                          })
                          .finally(() => setFileDeletingId(null));
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-[13px] font-bold uppercase tracking-widest text-secondary">
              История лечения
            </h3>
            <button
              type="button"
              onClick={() => setVisitFormOpen(true)}
              className="interactive-press-sm shrink-0 text-[12px] font-semibold text-primary px-2.5 py-1 rounded-lg border border-primary/30 bg-primary-light/60 dark:bg-primary/10"
            >
              + Запись
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {patientVisits.length === 0 ? (
              <p className="text-[13px] text-secondary py-4 text-center border border-dashed border-[#E2E8F0] dark:border-slate-700 rounded-2xl">
                Записей о проведённом лечении пока нет.
              </p>
            ) : (
              patientVisits.map((v) => (
                <div
                  key={v.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-[0_4px_14px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.28)]"
                >
                  <div className="flex justify-between gap-2">
                    <span className="text-[14px] font-semibold text-[#0F172A] dark:text-white">
                      {formatVisitDate(v.visitDate)}
                    </span>
                    <span className="text-[13px] font-bold text-primary shrink-0 tabular-nums">
                      {formatVisitPrice(v.price)}
                    </span>
                  </div>
                  <p className="text-[14px] font-semibold text-[#0F172A] dark:text-white mt-1">{v.procedureTitle}</p>
                  {v.doctorName && (
                    <p className="text-[12px] text-secondary mt-0.5">{v.doctorName}</p>
                  )}
                  {v.diagnosis && (
                    <p className="text-[12px] text-secondary mt-1">
                      <span className="font-semibold">Диагноз:</span> {v.diagnosis}
                    </p>
                  )}
                  {v.procedureDescription && (
                    <p className="text-[12px] text-secondary mt-0.5">{v.procedureDescription}</p>
                  )}
                  {v.toothNumbers.length > 0 && (
                    <p className="text-[11px] font-medium text-primary mt-1">
                      {formatToothNumbers(v.toothNumbers)}
                    </p>
                  )}
                  {v.materials && (
                    <p className="text-[11px] text-secondary mt-0.5">Материалы: {v.materials}</p>
                  )}
                  {v.clinicalNotes && (
                    <p className="text-[11px] text-secondary/90 mt-1.5 italic border-t border-slate-100 dark:border-slate-800 pt-1.5">
                      {v.clinicalNotes}
                    </p>
                  )}
                  {!v.visibleToPatient && (
                    <p className="text-[10px] font-semibold text-secondary mt-1">Скрыто от пациента</p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

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
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-[0_4px_14px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.28)]"
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
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 flex justify-between gap-3 shadow-[0_4px_14px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.28)]"
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
                        <p className="text-[11px] font-semibold text-primary mt-0.5">{planPhaseRu(st)}</p>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </section>
      </div>

      {consiliumOpen && (
        <div className="fixed inset-0 z-[115] flex flex-col justify-end sm:justify-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] border-0 cursor-default"
            aria-label="Закрыть"
            onClick={() => !consiliumBusy && setConsiliumOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="consilium-pick-title"
            className="relative z-[1] w-full max-w-[440px] mx-auto rounded-t-[22px] sm:rounded-[22px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_-12px_40px_rgba(15,23,42,0.16)] max-h-[min(85dvh,560px)] flex flex-col"
          >
            <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Консилиум</p>
              <h3
                id="consilium-pick-title"
                className="text-[17px] font-bold text-[#0F172A] dark:text-white mt-1"
              >
                Кому направить случай?
              </h3>
              <p className="text-[12px] text-secondary mt-1 leading-snug">
                {patientTitle} — в чат уйдёт текст и снимок зубной формулы.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 pb-[max(12px,env(safe-area-inset-bottom))]">
              {consiliumColleagues.length === 0 ? (
                <p className="text-[13px] text-secondary text-center py-8 px-2">
                  Нет других врачей в клинике. Проверьте таблицу сотрудников в Supabase.
                </p>
              ) : (
                consiliumColleagues.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    disabled={consiliumBusy}
                    onClick={() => void sendConsiliumTo(doc)}
                    className="w-full text-left rounded-xl px-3 py-3 mb-1 flex items-center gap-3 border border-transparent hover:bg-primary-light/60 dark:hover:bg-primary/10 transition-colors disabled:opacity-50"
                  >
                    <div className="h-11 w-11 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 text-[15px] font-bold">
                      {doc.fullName.trim().charAt(0) || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-[#0F172A] dark:text-white truncate">
                        {doc.fullName}
                      </p>
                      {doc.specialization ? (
                        <p className="text-[12px] text-secondary truncate">{doc.specialization}</p>
                      ) : (
                        <p className="text-[12px] text-secondary">Личный чат</p>
                      )}
                    </div>
                    <span className="text-primary text-lg shrink-0" aria-hidden>
                      →
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="shrink-0 px-4 py-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={consiliumBusy}
                onClick={() => setConsiliumOpen(false)}
                className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-600 text-[14px] font-semibold text-secondary interactive-press-sm"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {visitFormOpen && (
        <div className="fixed inset-0 z-[115] flex flex-col justify-end sm:justify-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] border-0 cursor-default"
            aria-label="Закрыть"
            onClick={() => !visitSaving && setVisitFormOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-[1] w-full max-w-[440px] mx-auto rounded-t-[22px] sm:rounded-[22px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_-12px_40px_rgba(15,23,42,0.16)] max-h-[min(90dvh,640px)] flex flex-col"
          >
            <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">История лечения</p>
              <div className="flex items-start justify-between gap-2 mt-1">
                <h3 className="text-[17px] font-bold text-[#0F172A] dark:text-white">Новая запись о лечении</h3>
                {canonicalPatientId && (
                  <button
                    type="button"
                    disabled={visitSaving}
                    onClick={() => {
                      void (async () => {
                        try {
                          const { callAiAssistant } = await import("@/lib/aiAssistant");
                          const res = await callAiAssistant({
                            action: "exam_draft",
                            patientId: canonicalPatientId,
                            briefNotes: [
                              visitForm.procedureTitle,
                              visitForm.diagnosis,
                              visitForm.procedureDescription,
                            ]
                              .filter(Boolean)
                              .join(". "),
                            toothNumbers: visitForm.toothNumbers,
                          });
                          if (res.examDraft) {
                            setVisitForm((f) => ({
                              ...f,
                              procedureTitle: res.examDraft!.procedureTitle || f.procedureTitle,
                              procedureDescription: res.examDraft!.procedureDescription || f.procedureDescription,
                              diagnosis: res.examDraft!.diagnosis || f.diagnosis,
                              clinicalNotes: res.examDraft!.clinicalNotes || f.clinicalNotes,
                              materials: res.examDraft!.materials || f.materials,
                            }));
                            showToast("AI-сгенерирован черновик", "success");
                          }
                        } catch (e) {
                          showToast(e instanceof Error ? e.message : "Ошибка AI", "error");
                        }
                      })();
                    }}
                    className="interactive-press-sm shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-[11px] font-semibold text-primary disabled:opacity-50"
                  >
                    ✦ AI
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-3 space-y-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-secondary uppercase">Дата</span>
                <input
                  type="date"
                  value={visitForm.visitDate}
                  onChange={(e) => setVisitForm((f) => ({ ...f, visitDate: e.target.value }))}
                  className="mt-1 w-full h-11 rounded-xl border border-primary/25 bg-white dark:bg-slate-900 px-3 text-[14px] outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-secondary uppercase">Процедура *</span>
                <input
                  value={visitForm.procedureTitle}
                  onChange={(e) => setVisitForm((f) => ({ ...f, procedureTitle: e.target.value }))}
                  placeholder="Пломбирование, гигиена…"
                  className="mt-1 w-full h-11 rounded-xl border border-primary/25 bg-white dark:bg-slate-900 px-3 text-[14px] outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-secondary uppercase">Зубы (через запятую)</span>
                <input
                  value={visitForm.toothNumbers}
                  onChange={(e) => setVisitForm((f) => ({ ...f, toothNumbers: e.target.value }))}
                  placeholder="16, 17"
                  className="mt-1 w-full h-11 rounded-xl border border-primary/25 bg-white dark:bg-slate-900 px-3 text-[14px] outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-secondary uppercase">Диагноз</span>
                <input
                  value={visitForm.diagnosis}
                  onChange={(e) => setVisitForm((f) => ({ ...f, diagnosis: e.target.value }))}
                  className="mt-1 w-full h-11 rounded-xl border border-primary/25 bg-white dark:bg-slate-900 px-3 text-[14px] outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-secondary uppercase">Описание</span>
                <textarea
                  value={visitForm.procedureDescription}
                  onChange={(e) => setVisitForm((f) => ({ ...f, procedureDescription: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-primary/25 bg-white dark:bg-slate-900 px-3 py-2 text-[13px] outline-none focus:border-primary resize-y"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-secondary uppercase">Материалы</span>
                <input
                  value={visitForm.materials}
                  onChange={(e) => setVisitForm((f) => ({ ...f, materials: e.target.value }))}
                  className="mt-1 w-full h-11 rounded-xl border border-primary/25 bg-white dark:bg-slate-900 px-3 text-[14px] outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-secondary uppercase">Стоимость, ₽</span>
                <input
                  type="number"
                  min={0}
                  value={visitForm.price}
                  onChange={(e) => setVisitForm((f) => ({ ...f, price: e.target.value }))}
                  className="mt-1 w-full h-11 rounded-xl border border-primary/25 bg-white dark:bg-slate-900 px-3 text-[14px] outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-secondary uppercase">Клин. заметки (только персонал)</span>
                <textarea
                  value={visitForm.clinicalNotes}
                  onChange={(e) => setVisitForm((f) => ({ ...f, clinicalNotes: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-primary/25 bg-white dark:bg-slate-900 px-3 py-2 text-[13px] outline-none focus:border-primary resize-y"
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visitForm.visibleToPatient}
                  onChange={(e) => setVisitForm((f) => ({ ...f, visibleToPatient: e.target.checked }))}
                  className="rounded border-primary/40 text-primary"
                />
                <span className="text-[13px] text-[#0F172A] dark:text-slate-200">Видно пациенту в приложении</span>
              </label>
            </div>
            <div className="shrink-0 px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex gap-2 pb-[max(12px,env(safe-area-inset-bottom))]">
              <button
                type="button"
                disabled={visitSaving}
                onClick={() => setVisitFormOpen(false)}
                className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-600 text-[14px] font-semibold text-secondary interactive-press-sm"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={visitSaving}
                onClick={() => void submitVisitForm()}
                className="flex-1 h-11 rounded-xl bg-primary text-white text-[14px] font-semibold interactive-press-sm disabled:opacity-50"
              >
                {visitSaving ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {recordFormOpen && (
        <div className="fixed inset-0 z-[115] flex flex-col justify-end sm:justify-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] border-0 cursor-default"
            aria-label="Закрыть"
            onClick={() => !recordSaving && setRecordFormOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-[1] w-full max-w-[440px] mx-auto rounded-t-[22px] sm:rounded-[22px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_-12px_40px_rgba(15,23,42,0.16)] max-h-[min(85dvh,520px)] flex flex-col"
          >
            <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Мед. карта</p>
              <h3 className="text-[17px] font-bold text-[#0F172A] dark:text-white mt-1">Новая мед. запись</h3>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-3 space-y-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-secondary uppercase">Тип</span>
                <select
                  value={recordForm.recordType}
                  onChange={(e) =>
                    setRecordForm((f) => ({
                      ...f,
                      recordType: e.target.value as MedicalRecordType,
                    }))
                  }
                  className="mt-1 w-full h-11 rounded-xl border border-primary/25 bg-white dark:bg-slate-900 px-3 text-[14px] outline-none focus:border-primary"
                >
                  {(Object.keys(RECORD_TYPE_LABELS) as MedicalRecordType[]).map((t) => (
                    <option key={t} value={t}>
                      {RECORD_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-secondary uppercase">Название *</span>
                <input
                  value={recordForm.title}
                  onChange={(e) => setRecordForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Лидокаин, бронхиальная астма…"
                  className="mt-1 w-full h-11 rounded-xl border border-primary/25 bg-white dark:bg-slate-900 px-3 text-[14px] outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-secondary uppercase">Описание</span>
                <textarea
                  value={recordForm.description}
                  onChange={(e) => setRecordForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-primary/25 bg-white dark:bg-slate-900 px-3 py-2 text-[13px] outline-none focus:border-primary resize-y"
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recordForm.visibleToPatient}
                  onChange={(e) => setRecordForm((f) => ({ ...f, visibleToPatient: e.target.checked }))}
                  className="rounded border-primary/40 text-primary"
                />
                <span className="text-[13px] text-[#0F172A] dark:text-slate-200">Видно пациенту</span>
              </label>
            </div>
            <div className="shrink-0 px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex gap-2 pb-[max(12px,env(safe-area-inset-bottom))]">
              <button
                type="button"
                disabled={recordSaving}
                onClick={() => setRecordFormOpen(false)}
                className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-600 text-[14px] font-semibold text-secondary interactive-press-sm"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={recordSaving}
                onClick={() => void submitRecordForm()}
                className="flex-1 h-11 rounded-xl bg-primary text-white text-[14px] font-semibold interactive-press-sm disabled:opacity-50"
              >
                {recordSaving ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {sheetTooth !== null && (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end sm:justify-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 z-0 bg-black/40 backdrop-blur-[2px] border-0 cursor-default"
            onClick={closeToothSheet}
            aria-label="Закрыть выбор статуса"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tooth-sheet-title"
            className="relative z-[1] w-[92%] max-w-md mx-auto mb-4 sm:mb-0 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-[0_12px_48px_rgba(15,23,42,0.18)] dark:shadow-[0_12px_48px_rgba(0,0,0,0.45)] border border-slate-200/90 dark:border-slate-700 pb-[max(20px,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-start justify-between gap-3 mb-1 min-w-0">
              <h3
                id="tooth-sheet-title"
                className="text-[17px] font-bold text-[#0F172A] dark:text-white leading-snug min-w-0 flex-1 break-words pr-1"
              >
                Выберите статус для зуба №{sheetTooth}
              </h3>
              <button
                type="button"
                onClick={closeToothSheet}
                className="interactive-press-sm shrink-0 w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-secondary flex items-center justify-center shadow-raised-surface"
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>
            <p className="text-[12px] text-secondary mb-4">Тапните по нужному статусу — изменение сразу сохранится.</p>
            <div className="flex flex-col gap-3">
              {DOCTOR_TOOTH_STATUS_MENU.map((item) => {
                const active =
                  formulaTeeth.find((t) => t.number === sheetTooth)?.condition === item.condition;
                return (
                  <button
                    key={item.condition}
                    type="button"
                    onClick={() => void applyDoctorToothCondition(item.condition)}
                    className={`interactive-press-sm w-full min-h-[52px] rounded-2xl border-2 px-4 py-3.5 text-left transition-colors duration-150 ${
                      active
                        ? "border-primary bg-primary text-white shadow-[0_6px_20px_rgba(36,139,207,0.35)]"
                        : "border-primary/35 bg-[#F0F7FD] dark:bg-slate-800/80 text-[#0F172A] dark:text-white hover:border-primary/60 active:scale-[0.99]"
                    }`}
                  >
                    <span className={`text-[16px] font-semibold ${active ? "text-white" : "text-[#0F172A] dark:text-white"}`}>
                      {item.label}
                    </span>
                    {item.hint ? (
                      <span
                        className={`block text-[12px] mt-0.5 ${active ? "text-white/85" : "text-secondary"}`}
                      >
                        {item.hint}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={closeToothSheet}
              className="mt-4 w-full h-12 rounded-2xl border-2 border-slate-200 dark:border-slate-600 text-[14px] font-semibold text-secondary interactive-press-sm"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <Toast
        variant="staffPlain"
        message={toastMessage}
        visible={toastVisible}
        tone={toastTone}
        className="z-[125]"
      />
    </div>
  );
}
