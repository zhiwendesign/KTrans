import { describe, expect, it } from "vitest";
import { buildPrompt, endpoint } from "./shared";

describe("provider helpers", () => {
  it("builds a translation-only prompt", () => {
    const prompt = buildPrompt({
      requestId: "test",
      text: "Hello, world!",
      sourceLanguage: "en",
      targetLanguage: "zh-CN"
    });
    expect(prompt).toContain("from en to zh-CN");
    expect(prompt).toContain("Return only the translation");
    expect(prompt).toContain("Hello, world!");
  });

  it("appends an endpoint without duplicating it", () => {
    expect(endpoint("https://example.com/v1", "/chat/completions")).toBe("https://example.com/v1/chat/completions");
    expect(endpoint("https://example.com/v1/chat/completions/", "/chat/completions")).toBe("https://example.com/v1/chat/completions");
  });

  it("rejects non-http URLs", () => {
    expect(() => endpoint("javascript:alert(1)", "/chat/completions")).toThrow("HTTP");
  });
});
