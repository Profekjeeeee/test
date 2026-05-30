import "server-only";

import { apiError } from "@/lib/server/api/apiError";
import { chatCompletion, chatCompletionJson } from "@/lib/server/ai/openaiClient";
import { buildPatientAiContext } from "@/lib/server/ai/patientContext";
import {
  examDraftMessages,
  explainDiagnosisMessages,
  medcardSearchMessages,
  patientSummaryMessages,
  recommendationsMessages,
} from "@/lib/server/ai/prompts";
import {
  createDentalServiceContext,
  loadClient,
  loadEmployee,
  requireActor,
  safeDentalScalarId,
  type DentalServiceContext,
} from "@/lib/server/services/shared/accessControl";
import { assertAiEnabled } from "@/lib/server/planLimits";

export type AiAction =
  | "exam_draft"
  | "recommendations"
  | "medcard_search"
  | "patient_summary"
  | "explain_diagnosis";

const DOCTOR_ACTIONS: AiAction[] = [
  "exam_draft",
  "recommendations",
  "medcard_search",
  "patient_summary",
];
const PATIENT_ACTIONS: AiAction[] = ["medcard_search", "explain_diagnosis"];

export interface ExamDraftResult {
  procedureTitle: string;
  procedureDescription: string;
  diagnosis: string;
  clinicalNotes: string;
  materials: string;
}

export interface AiServiceResult {
  action: AiAction;
  text?: string;
  examDraft?: ExamDraftResult;
  recommendations?: string[];
}

async function assertPatientAccess(
  ctx: DentalServiceContext,
  patientId: string,
): Promise<{ staffView: boolean }> {
  const act = requireActor(ctx.actor);
  const pid = safeDentalScalarId(patientId, "patientId");

  if (act.role === "client") {
    const me = await loadClient(ctx.adm, act, ctx.gate);
    if (safeDentalScalarId(String(me.id ?? ""), "patient") !== pid) {
      apiError(403, "Нет доступа к медкарте другого пациента.");
    }
    return { staffView: false };
  }

  const emp = await loadEmployee(ctx.adm, act, ctx.gate);

  const { data: patient, error: pErr } = await ctx.adm
    .from("dental_clients")
    .select("id, clinic_id")
    .eq("id", pid)
    .maybeSingle();

  if (pErr) apiError(500, pErr.message);
  if (!patient) apiError(404, "Пациент не найден.");

  const patientRow = patient as { id?: string; clinic_id?: string | null };
  const empClinic = String((emp as { clinic_id?: unknown }).clinic_id ?? "");
  const patientClinic = String(patientRow.clinic_id ?? "");

  if (empClinic && patientClinic && empClinic !== patientClinic) {
    apiError(403, "Пациент из другой клиники.");
  }

  if (act.role === "admin") {
    return { staffView: true };
  }

  const { count, error: aErr } = await ctx.adm
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("client_id", pid)
    .eq("doctor_id", act.id);

  if (aErr) apiError(500, aErr.message);
  if (!count) {
    apiError(403, "Нет доступа к медкарте этого пациента.");
  }

  return { staffView: true };
}

function parseAction(raw: unknown): AiAction {
  const action = typeof raw === "string" ? raw.trim() : "";
  const allowed: AiAction[] = [
    "exam_draft",
    "recommendations",
    "medcard_search",
    "patient_summary",
    "explain_diagnosis",
  ];
  if (!allowed.includes(action as AiAction)) {
    apiError(400, "Некорректное действие AI.");
  }
  return action as AiAction;
}

function assertActionAllowed(action: AiAction, role: "client" | "doctor" | "admin"): void {
  if (role === "client" && !PATIENT_ACTIONS.includes(action)) {
    apiError(403, "Действие недоступно для пациента.");
  }
  if (role === "doctor" && !DOCTOR_ACTIONS.includes(action)) {
    apiError(403, "Действие недоступно.");
  }
}

export async function runAiAssistant(
  gate: DentalServiceContext["gate"],
  actor: DentalServiceContext["actor"],
  body: Record<string, unknown>,
): Promise<AiServiceResult> {
  const ctx = createDentalServiceContext(gate, actor);
  const act = requireActor(ctx.actor);
  const action = parseAction(body.action);
  assertActionAllowed(action, act.role);
  await assertAiEnabled();

  const patientId =
    act.role === "client"
      ? act.id
      : safeDentalScalarId(body.patientId, "patientId");

  const { staffView } = await assertPatientAccess(ctx, patientId);
  const patientCtx = await buildPatientAiContext(ctx.adm, patientId, { staffView });

  switch (action) {
    case "exam_draft": {
      const briefNotes = typeof body.briefNotes === "string" ? body.briefNotes : "";
      const toothNumbers = typeof body.toothNumbers === "string" ? body.toothNumbers : "";
      const draft = await chatCompletionJson<ExamDraftResult>(
        examDraftMessages(patientCtx, briefNotes, toothNumbers),
      );
      return {
        action,
        examDraft: {
          procedureTitle: String(draft.procedureTitle ?? "").trim(),
          procedureDescription: String(draft.procedureDescription ?? "").trim(),
          diagnosis: String(draft.diagnosis ?? "").trim(),
          clinicalNotes: String(draft.clinicalNotes ?? "").trim(),
          materials: String(draft.materials ?? "").trim(),
        },
      };
    }

    case "recommendations": {
      const res = await chatCompletionJson<{ recommendations?: string[] }>(
        recommendationsMessages(patientCtx),
      );
      const list = Array.isArray(res.recommendations)
        ? res.recommendations.map((s) => String(s).trim()).filter(Boolean)
        : [];
      return { action, recommendations: list };
    }

    case "medcard_search": {
      const query = typeof body.query === "string" ? body.query.trim() : "";
      if (!query) apiError(400, "Укажите вопрос для поиска.");
      if (query.length > 500) apiError(400, "Вопрос слишком длинный.");
      const text = await chatCompletion(medcardSearchMessages(patientCtx, query, staffView));
      return { action, text };
    }

    case "patient_summary": {
      const text = await chatCompletion(patientSummaryMessages(patientCtx));
      return { action, text };
    }

    case "explain_diagnosis": {
      const diagnosis = typeof body.diagnosis === "string" ? body.diagnosis.trim() : "";
      if (!diagnosis) apiError(400, "Укажите диагноз для объяснения.");
      const procedureTitle =
        typeof body.procedureTitle === "string" ? body.procedureTitle : undefined;
      const text = await chatCompletion(
        explainDiagnosisMessages(patientCtx, diagnosis, procedureTitle),
      );
      return { action, text };
    }

    default:
      apiError(400, "Неизвестное действие.");
  }
}
