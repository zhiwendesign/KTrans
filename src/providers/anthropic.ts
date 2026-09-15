import type { ProviderConfig, TranslationRequest } from "../types";
import { normalizeHttpError, ProviderError } from "./errors";
import { buildHeaders, buildPrompt, endpoint, readSse } from "./shared";

export async function* translateAnthropic(
  request: TranslationRequest,
  config: ProviderConfig,
  signal: AbortSignal
): AsyncGenerator<string> {
  const response = await fetch(endpoint(config.baseUrl, "/v1/messages"), {
    method: "POST",
    headers: buildHeaders(config, {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      ...(config.apiKey ? { "x-api-key": config.apiKey } : {})
    }),
    body: JSON.stringify({
      model: config.model,
      system: "You are a precise translation engine.",
      messages: [{ role: "user", content: buildPrompt(request) }],
      temperature: config.temperature,
      max_tokens: config.maxTokens ?? 2048,
      stream: config.stream
    }),
    signal
  });

  if (!response.ok) throw normalizeHttpError(response.status, await response.text());

  if (!config.stream) {
    const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.filter((item) => item.type === "text").map((item) => item.text ?? "").join("");
    if (!text) throw new ProviderError("PARSE", "服务返回了不兼容的 Anthropic 响应。");
    yield text;
    return;
  }

  for await (const event of readSse(response, signal)) {
    try {
      const data = JSON.parse(event) as { type?: string; delta?: { type?: string; text?: string } };
      if (data.type === "content_block_delta" && data.delta?.type === "text_delta" && data.delta.text) {
        yield data.delta.text;
      }
    } catch {
      throw new ProviderError("PARSE", "无法解析 Anthropic 流式响应。");
    }
  }
}
