import type { ProviderConfig, TranslationRequest } from "../types";
import { ProviderError } from "./errors";

export function buildPrompt(request: TranslationRequest): string {
  const source = request.sourceLanguage === "auto" ? "automatically detected language" : request.sourceLanguage;
  return [
    `Translate the text from ${source} to ${request.targetLanguage}.`,
    "Preserve Markdown, code, URLs, variables, and proper nouns when appropriate.",
    "Return only the translation without commentary or labels.",
    "",
    request.text
  ].join("\n");
}

export function buildHeaders(config: ProviderConfig, base: Record<string, string>): Headers {
  const headers = new Headers({ ...base, ...config.customHeaders });
  return headers;
}

export function endpoint(baseUrl: string, suffix: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(clean)) throw new ProviderError("URL", "API 地址必须使用 HTTP 或 HTTPS。");
  return clean.endsWith(suffix) ? clean : `${clean}${suffix}`;
}

export async function* readSse(response: Response, signal: AbortSignal): AsyncGenerator<string> {
  if (!response.body) throw new ProviderError("PARSE", "服务未返回可读取的响应内容。");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      for (const event of events) {
        for (const line of event.split(/\r?\n/)) {
          if (line.startsWith("data:")) yield line.slice(5).trim();
        }
      }
    }
    if (buffer.trim()) {
      for (const line of buffer.split(/\r?\n/)) {
        if (line.startsWith("data:")) yield line.slice(5).trim();
      }
    }
  } finally {
    reader.releaseLock();
  }
}
