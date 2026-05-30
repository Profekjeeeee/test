import "server-only";

import { apiError } from "@/lib/server/api/apiError";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function getAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    apiError(503, "AI-сервис не настроен. Добавьте OPENAI_API_KEY в переменные окружения.");
  }
  return {
    apiKey: apiKey!,
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
    baseUrl: (process.env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, ""),
  };
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** Вызов chat/completions через fetch (без SDK). */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean },
): Promise<string> {
  const { apiKey, model, baseUrl } = getAiConfig();

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.4,
      max_tokens: options?.maxTokens ?? 1800,
      ...(options?.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[ai] OpenAI error", res.status, detail.slice(0, 400));
    apiError(502, "Ошибка AI-сервиса. Попробуйте позже.");
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) apiError(502, "Пустой ответ AI-сервиса.");
  return content;
}

export async function chatCompletionJson<T>(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<T> {
  const raw = await chatCompletion(messages, { ...options, jsonMode: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    apiError(502, "AI вернул некорректный JSON.");
  }
}
