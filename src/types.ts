export type ProviderProtocol = "openai" | "anthropic";
export type ThemeMode = "system" | "light" | "dark";
export type TriggerMode = "button" | "instant" | "shortcut";

export interface ProviderConfig {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  customHeaders: Record<string, string>;
  temperature: number;
  maxTokens?: number;
  stream: boolean;
  timeoutMs: number;
  lastTest?: {
    ok: boolean;
    message: string;
    at: number;
  };
}

export interface Settings {
  providers: ProviderConfig[];
  defaultProviderId?: string;
  sourceLanguage: string;
  targetLanguage: string;
  theme: ThemeMode;
  triggerMode: TriggerMode;
  showSource: boolean;
  fontSize: "small" | "medium" | "large";
  disabledHosts: string[];
  locale: "zh-CN" | "en";
}

export interface TranslationRequest {
  requestId: string;
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  providerId?: string;
}

export type TranslationPortMessage =
  | { type: "translate"; payload: TranslationRequest }
  | { type: "cancel"; requestId: string };

export type TranslationPortResponse =
  | { type: "start"; requestId: string }
  | { type: "delta"; requestId: string; text: string }
  | { type: "done"; requestId: string; text: string }
  | { type: "error"; requestId: string; code: string; message: string };

export interface SelectionPayload {
  text: string;
  rect: { top: number; left: number; right: number; bottom: number; width: number; height: number };
}
