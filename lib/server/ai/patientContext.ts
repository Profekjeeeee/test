import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { apiError } from "@/lib/server/api/apiError";
import { safeDentalScalarId } from "@/lib/server/services/shared/accessControl";

export interface PatientAiContext {
  patientId: string;
  patientName: string;
  age: number | null;
  phone: string;
  internalNotes: string;
  formulaSummary: string;
  medicalRecords: string;
  visits: string;
  treatmentPlan: string;
  files: string;
}

function formatFormulaTeeth(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return "Не заполнена.";
  const lines: string[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const o = t as Record<string, unknown>;
    const num = o.number ?? o.tooth ?? o.id;
    const status = o.status ?? o.condition;
    if (num != null && status && status !== "healthy") {
      lines.push(`Зуб ${num}: ${status}`);
    }
  }
  return lines.length ? lines.join("; ") : "Все зубы без отмеченных патологий.";
}

const RECORD_TYPE_RU: Record<string, string> = {
  allergy: "Аллергия",
  chronic: "Хроническое",
  medication: "Препарат",
  contraindication: "Противопоказание",
  general: "Общее",
};

/** Загрузка и сериализация медданных пациента для промптов AI. */
export async function buildPatientAiContext(
  adm: SupabaseClient,
  patientId: string,
  options: { staffView: boolean },
): Promise<PatientAiContext> {
  const pid = safeDentalScalarId(patientId, "patientId");

  const { data: client, error: cErr } = await adm
    .from("dental_clients")
    .select("id, first_name, last_name, phone, internal_notes, formula_teeth")
    .eq("id", pid)
    .maybeSingle();

  if (cErr) apiError(500, cErr.message);
  if (!client) apiError(404, "Пациент не найден.");

  const row = client as Record<string, unknown>;
  const firstName = String(row.first_name ?? "").trim();
  const lastName = String(row.last_name ?? "").trim();
  const patientName = [firstName, lastName].filter(Boolean).join(" ") || "Пациент";

  let recordsQuery = adm
    .from("medical_records")
    .select("record_type, title, description, severity, is_active")
    .eq("patient_id", pid)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(30);

  if (!options.staffView) {
    recordsQuery = recordsQuery.eq("visible_to_patient", true);
  }

  let visitsQuery = adm
    .from("patient_visits")
    .select(
      "visit_date, procedure_title, procedure_description, tooth_numbers, diagnosis, clinical_notes, materials, price",
    )
    .eq("patient_id", pid)
    .order("visit_date", { ascending: false })
    .limit(25);

  if (!options.staffView) {
    visitsQuery = visitsQuery.eq("visible_to_patient", true);
  }

  const [recordsRes, visitsRes, planRes, filesRes] = await Promise.all([
    recordsQuery,
    visitsQuery,
    adm
      .from("treatment_plan_items")
      .select("title, status, description, category, planned_date")
      .eq("patient_id", pid)
      .order("priority", { ascending: true })
      .limit(40),
    adm
      .from("patient_files")
      .select("file_name, file_category, description, created_at")
      .eq("patient_id", pid)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  if (recordsRes.error) apiError(500, recordsRes.error.message);
  if (visitsRes.error) apiError(500, visitsRes.error.message);
  if (planRes.error) apiError(500, planRes.error.message);
  if (filesRes.error) apiError(500, filesRes.error.message);

  const medicalRecords = (recordsRes.data ?? [])
    .map((r) => {
      const rec = r as Record<string, unknown>;
      const type = RECORD_TYPE_RU[String(rec.record_type ?? "")] ?? String(rec.record_type ?? "");
      const title = String(rec.title ?? "");
      const desc = String(rec.description ?? "").trim();
      const sev = rec.severity ? ` (${rec.severity})` : "";
      return desc ? `[${type}] ${title}${sev}: ${desc}` : `[${type}] ${title}${sev}`;
    })
    .join("\n");

  const visits = (visitsRes.data ?? [])
    .map((v) => {
      const visit = v as Record<string, unknown>;
      const date = String(visit.visit_date ?? "");
      const teeth = Array.isArray(visit.tooth_numbers)
        ? (visit.tooth_numbers as number[]).join(", ")
        : "";
      const parts = [
        `${date} — ${String(visit.procedure_title ?? "")}`,
        visit.diagnosis ? `Диагноз: ${visit.diagnosis}` : "",
        visit.procedure_description ? `Описание: ${visit.procedure_description}` : "",
        teeth ? `Зубы: ${teeth}` : "",
        visit.materials ? `Материалы: ${visit.materials}` : "",
        options.staffView && visit.clinical_notes
          ? `Клин. заметки: ${visit.clinical_notes}`
          : "",
      ].filter(Boolean);
      return parts.join(". ");
    })
    .join("\n");

  const treatmentPlan = (planRes.data ?? [])
    .map((p) => {
      const item = p as Record<string, unknown>;
      const category = String(item.category ?? "").trim();
      const planned = item.planned_date ? `, план ${item.planned_date}` : "";
      const desc = String(item.description ?? "").trim();
      return `- ${String(item.title ?? "")} [${String(item.status ?? "")}]${category ? ` (${category})` : ""}${planned}${desc ? `: ${desc}` : ""}`;
    })
    .join("\n");

  const files = (filesRes.data ?? [])
    .map((f) => {
      const file = f as Record<string, unknown>;
      return `${String(file.file_name ?? "")} (${String(file.file_category ?? "")})${file.description ? `: ${file.description}` : ""}`;
    })
    .join("\n");

  return {
    patientId: pid,
    patientName,
    age: null,
    phone: String(row.phone ?? ""),
    internalNotes: options.staffView ? String(row.internal_notes ?? "").trim() : "",
    formulaSummary: formatFormulaTeeth(row.formula_teeth),
    medicalRecords: medicalRecords || "Нет записей.",
    visits: visits || "Нет визитов.",
    treatmentPlan: treatmentPlan || "План лечения не составлен.",
    files: files || "Нет файлов.",
  };
}

export function contextToPromptBlock(ctx: PatientAiContext, includeInternal = false): string {
  const lines = [
    `Пациент: ${ctx.patientName}${ctx.age != null ? `, ${ctx.age} лет` : ""}`,
    `Зубная формула: ${ctx.formulaSummary}`,
    `\nМед. данные:\n${ctx.medicalRecords}`,
    `\nИстория визитов:\n${ctx.visits}`,
    `\nПлан лечения:\n${ctx.treatmentPlan}`,
  ];
  if (includeInternal && ctx.internalNotes) {
    lines.push(`\nВнутренние заметки персонала:\n${ctx.internalNotes}`);
  }
  if (ctx.files !== "Нет файлов.") {
    lines.push(`\nФайлы:\n${ctx.files}`);
  }
  return lines.join("\n");
}
