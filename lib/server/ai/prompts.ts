import "server-only";

import type { PatientAiContext } from "@/lib/server/ai/patientContext";
import { contextToPromptBlock } from "@/lib/server/ai/patientContext";
import type { ChatMessage } from "@/lib/server/ai/geminiClient";

const DENTAL_SYSTEM =
  "Ты — AI-ассистент стоматологической клиники. Отвечай на русском языке. " +
  "Используй только предоставленные медицинские данные; не выдумывай факты. " +
  "Если данных недостаточно — явно укажи это. " +
  "Не ставь окончательных диагнозов и не назначай лечение без врача — формулируй как помощь врачу или информацию для пациента.";

export function examDraftMessages(
  ctx: PatientAiContext,
  briefNotes: string,
  toothNumbers?: string,
): ChatMessage[] {
  const context = contextToPromptBlock(ctx, true);
  return [
    { role: "system", content: DENTAL_SYSTEM },
    {
      role: "user",
      content:
        `${context}\n\n` +
        `Задача: подготовить черновик записи осмотра/процедуры на основе кратких заметок врача.\n` +
        `Краткие заметки врача: ${briefNotes.trim() || "не указаны"}\n` +
        (toothNumbers?.trim() ? `Зубы: ${toothNumbers.trim()}\n` : "") +
        `\nВерни JSON с полями:\n` +
        `- procedureTitle (название процедуры)\n` +
        `- procedureDescription (описание проведённого/планируемого)\n` +
        `- diagnosis (диагноз по МКБ/стоматологической терминологии, если применимо)\n` +
        `- clinicalNotes (рекомендации пациенту после процедуры, видимые в ЛК)\n` +
        `- materials (использованные материалы, если известны)\n` +
        `Все поля — строки на русском.`,
    },
  ];
}

export function recommendationsMessages(ctx: PatientAiContext): ChatMessage[] {
  const context = contextToPromptBlock(ctx, true);
  return [
    { role: "system", content: DENTAL_SYSTEM },
    {
      role: "user",
      content:
        `${context}\n\n` +
        `Задача: сформулировать 3–5 персональных рекомендаций для пациента после последних визитов.\n` +
        `Верни JSON: { "recommendations": ["...", "..."] }\n` +
        `Рекомендации — конкретные, практичные, без дублирования. Учитывай аллергии и противопоказания.`,
    },
  ];
}

export function medcardSearchMessages(
  ctx: PatientAiContext,
  query: string,
  staffView: boolean,
): ChatMessage[] {
  const context = contextToPromptBlock(ctx, staffView);
  return [
    { role: "system", content: DENTAL_SYSTEM },
    {
      role: "user",
      content:
        `${context}\n\n` +
        `Вопрос пользователя: ${query.trim()}\n\n` +
        `Ответь на вопрос, опираясь только на данные медкарты выше. ` +
        `Если ответа нет в данных — скажи об этом. Структурируй ответ кратко (2–6 предложений).`,
    },
  ];
}

export function patientSummaryMessages(ctx: PatientAiContext): ChatMessage[] {
  const context = contextToPromptBlock(ctx, true);
  return [
    { role: "system", content: DENTAL_SYSTEM },
    {
      role: "user",
      content:
        `${context}\n\n` +
        `Задача: краткая клиническая сводка для врача перед приёмом (5–8 пунктов).\n` +
        `Включи: ключевые диагнозы, активные проблемы по формуле, аллергии/противопоказания, ` +
        `статус плана лечения, на что обратить внимание. Формат — маркированный список на русском.`,
    },
  ];
}

export function explainDiagnosisMessages(
  ctx: PatientAiContext,
  diagnosis: string,
  procedureTitle?: string,
): ChatMessage[] {
  const context = contextToPromptBlock(ctx, false);
  return [
    {
      role: "system",
      content:
        DENTAL_SYSTEM +
        " Объясняй простым языком, без жаргона. 2–4 коротких абзаца. Успокаивающий тон. " +
        "Не пугай. В конце — 1–2 совета по уходу, если уместно.",
    },
    {
      role: "user",
      content:
        `${context}\n\n` +
        `Объясни пациенту простым языком:\n` +
        `Диагноз: ${diagnosis.trim()}\n` +
        (procedureTitle?.trim() ? `Процедура: ${procedureTitle.trim()}\n` : "") +
        `\nНе используй сложные медицинские термины без пояснения.`,
    },
  ];
}
