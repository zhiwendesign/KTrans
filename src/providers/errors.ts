export class ProviderError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number
  ) {
    super(message);
  }
}

export function normalizeHttpError(status: number, body: string): ProviderError {
  const detail = body.slice(0, 300);
  if (status === 401 || status === 403) {
    return new ProviderError("AUTH", "API Key 无效或没有访问权限。", status);
  }
  if (status === 404) {
    return new ProviderError("NOT_FOUND", "API 地址、接口路径或模型不存在。", status);
  }
  if (status === 429) {
    return new ProviderError("RATE_LIMIT", "请求过于频繁，或账户额度不足。", status);
  }
  if (status >= 500) {
    return new ProviderError("SERVER", "翻译服务暂时不可用，请稍后重试。", status);
  }
  return new ProviderError("HTTP", `翻译服务返回错误 ${status}${detail ? `：${detail}` : ""}`, status);
}

export function normalizeError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ProviderError("CANCELLED", "翻译已停止。");
  }
  if (error instanceof TypeError) {
    return new ProviderError("NETWORK", "无法连接翻译服务，请检查网络、地址和访问权限。");
  }
  return new ProviderError("UNKNOWN", error instanceof Error ? error.message : "翻译失败，请重试。");
}
