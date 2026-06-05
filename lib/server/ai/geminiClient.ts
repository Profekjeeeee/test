import "server-only";

import { apiError } from "@/lib/server/api/apiError";

const DEFAULT_MODEL = "gemini-2.0-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function getAiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    apiError(503, "AI-сервис не настроен. Добавьте GEMINI_API_KEY в переменные окружения.");
  }
  return {
    apiKey: apiKey!,
    model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
  };
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

function buildGeminiBody(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean },
) {
  const systemParts: string[] = [];
  const contents: GeminiContent[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push(msg.content);
      continue;
    }
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  if (!contents.length) {
    apiError(400, "Пустой запрос к AI-сервису.");
  }

  return {
    ...(systemParts.length
      ? { systemInstruction: { parts: [{ text: systemParts.join("\n\n") }] } }
      : {}),
    contents,
    generationConfig: {
      temperature: options?.temperature ?? 0.4,
      maxOutputTokens: options?.maxTokens ?? 1800,
      ...(options?.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };
}

function extractGeminiText(json: {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}): string {
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) apiError(502, "Пустой ответ AI-сервиса.");
  return text;
}

/** Вызов Gemini generateContent через fetch (без SDK). */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean },
): Promise<string> {
  const { apiKey, model } = getAiConfig();
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(buildGeminiBody(messages, options)),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[ai] Gemini error", res.status, detail.slice(0, 400));
    apiError(502, "Ошибка AI-сервиса. Попробуйте позже.");
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return extractGeminiText(json);
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
