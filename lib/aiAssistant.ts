import { dentalApiFetch } from "@/lib/api/fetchApi";

export type AiAction =
  | "exam_draft"
  | "recommendations"
  | "medcard_search"
  | "patient_summary"
  | "explain_diagnosis";

export interface ExamDraftResult {
  procedureTitle: string;
  procedureDescription: string;
  diagnosis: string;
  clinicalNotes: string;
  materials: string;
}

export interface AiAssistantResponse {
  action: AiAction;
  text?: string;
  examDraft?: ExamDraftResult;
  recommendations?: string[];
}

interface AiRequestBase {
  action: AiAction;
  patientId?: string;
}

export interface AiExamDraftRequest extends AiRequestBase {
  action: "exam_draft";
  patientId: string;
  briefNotes: string;
  toothNumbers?: string;
}

export interface AiRecommendationsRequest extends AiRequestBase {
  action: "recommendations";
  patientId: string;
}

export interface AiMedcardSearchRequest extends AiRequestBase {
  action: "medcard_search";
  patientId?: string;
  query: string;
}

export interface AiPatientSummaryRequest extends AiRequestBase {
  action: "patient_summary";
  patientId: string;
}

export interface AiExplainDiagnosisRequest extends AiRequestBase {
  action: "explain_diagnosis";
  diagnosis: string;
  procedureTitle?: string;
}

export type AiAssistantRequest =
  | AiExamDraftRequest
  | AiRecommendationsRequest
  | AiMedcardSearchRequest
  | AiPatientSummaryRequest
  | AiExplainDiagnosisRequest;

export async function callAiAssistant(req: AiAssistantRequest): Promise<AiAssistantResponse> {
  return dentalApiFetch<AiAssistantResponse>("/api/ai", {
    method: "POST",
    body: req as unknown as Record<string, unknown>,
  });
}

export const AI_ACTION_LABELS: Record<AiAction, string> = {
  exam_draft: "Черновик осмотра",
  recommendations: "Рекомендации",
  medcard_search: "Поиск по медкарте",
  patient_summary: "Сводка пациента",
  explain_diagnosis: "Объяснение диагноза",
};
