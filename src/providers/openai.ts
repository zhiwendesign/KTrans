import type { ProviderConfig, TranslationRequest } from "../types";
import { normalizeHttpError, ProviderError } from "./errors";
import { buildHeaders, buildPrompt, endpoint, readSse } from "./shared";

export async function* translateOpenAi(
  request: TranslationRequest,
  config: ProviderConfig,
  signal: AbortSignal
): AsyncGenerator<string> {
  const response = await fetch(endpoint(config.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: buildHeaders(config, {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
    }),
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: "You are a precise translation engine." },
        { role: "user", content: buildPrompt(request) }
      ],
      temperature: config.temperature,
      ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
      stream: config.stream
    }),
    signal
  });

  if (!response.ok) throw normalizeHttpError(response.status, await response.text());

  if (!config.stream) {
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new ProviderError("PARSE", "服务返回了不兼容的 OpenAI 响应。");
    yield text;
    return;
  }

  for await (const event of readSse(response, signal)) {
    if (event === "[DONE]") return;
    try {
      const data = JSON.parse(event) as { choices?: Array<{ delta?: { content?: string } }> };
      const text = data.choices?.[0]?.delta?.content;
      if (text) yield text;
    } catch {
      throw new ProviderError("PARSE", "无法解析 OpenAI 流式响应。");
    }
  }
}
