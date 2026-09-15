export const SETTINGS_KEY = "transpop:settings";
export const MAX_SELECTION_LENGTH = 10_000;

export const DEFAULT_SETTINGS = {
  providers: [],
  sourceLanguage: "auto",
  targetLanguage: "zh-CN",
  theme: "system",
  triggerMode: "button",
  showSource: true,
  fontSize: "medium",
  disabledHosts: [],
  locale: "zh-CN"
} as const;

export const LANGUAGES = [
  ["auto", "自动检测", "Auto detect"],
  ["zh-CN", "简体中文", "Simplified Chinese"],
  ["zh-TW", "繁体中文", "Traditional Chinese"],
  ["en", "英语", "English"],
  ["ja", "日语", "Japanese"],
  ["ko", "韩语", "Korean"],
  ["fr", "法语", "French"],
  ["de", "德语", "German"],
  ["es", "西班牙语", "Spanish"],
  ["ru", "俄语", "Russian"],
  ["pt", "葡萄牙语", "Portuguese"],
  ["it", "意大利语", "Italian"]
] as const;
