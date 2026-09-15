import type { ProviderConfig, TranslationRequest } from "../types";
import { translateAnthropic } from "./anthropic";
import { translateOpenAi } from "./openai";

export function translate(
  request: TranslationRequest,
  config: ProviderConfig,
  signal: AbortSignal
): AsyncGenerator<string> {
  return config.protocol === "anthropic"
    ? translateAnthropic(request, config, signal)
    : translateOpenAi(request, config, signal);
}
