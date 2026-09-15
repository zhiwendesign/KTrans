const messages = {
  "zh-CN": {
    translate: "翻译",
    translating: "正在翻译…",
    copy: "复制译文",
    copied: "已复制",
    retry: "重新翻译",
    cancel: "停止",
    close: "关闭",
    settings: "打开设置",
    noProvider: "尚未配置翻译服务",
    noProviderDetail: "请先添加 API 地址、密钥和模型。",
    emptyResult: "服务未返回译文",
    tooLong: "选中文字超过 10,000 个字符，请缩短选区。"
  },
  en: {
    translate: "Translate",
    translating: "Translating…",
    copy: "Copy translation",
    copied: "Copied",
    retry: "Translate again",
    cancel: "Stop",
    close: "Close",
    settings: "Open settings",
    noProvider: "No translation provider",
    noProviderDetail: "Add an API URL, key, and model first.",
    emptyResult: "The service returned no translation",
    tooLong: "The selection is over 10,000 characters."
  }
} as const;

export function t(locale: "zh-CN" | "en", key: keyof (typeof messages)["zh-CN"]): string {
  return messages[locale][key];
}
