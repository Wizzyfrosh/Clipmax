import { afterEach, describe, expect, it, vi } from "vitest";
import { aiProviderSettings, classifyAiError } from "../packages/ai/provider";

afterEach(() => vi.unstubAllEnvs());

describe("Groq free-tier AI adapter", () => {
  it("selects only Groq with validated models and conservative output", () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    expect(aiProviderSettings()).toEqual({
      name: "groq",
      transcriptionModel: "whisper-large-v3-turbo",
      textModel: "openai/gpt-oss-20b",
      maxCompletionTokens: 3000,
    });
  });
  it("does not silently switch to paid OpenAI on unknown provider", () => {
    vi.stubEnv("AI_PROVIDER", "invalid");
    expect(() => aiProviderSettings()).toThrow("AI_PROVIDER_UNSUPPORTED");
  });
  it("keeps legacy OpenAI available only by explicit selection", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("TEXT_MODEL", "gpt-4o-mini");
    expect(aiProviderSettings().transcriptionModel).toBe("whisper-1");
    expect(aiProviderSettings().textModel).toBe("gpt-4o-mini");
  });
  it("maps quota and authorization errors without leaking details", () => {
    expect(classifyAiError({ status: 429, message: "sensitive request" }).message).toBe("AI_FREE_TIER_LIMIT");
    expect(classifyAiError({ status: 401 }).message).toBe("AI_PROVIDER_AUTH_FAILED");
    expect(classifyAiError({ status: 413 }).message).toBe("TRANSCRIPTION_FILE_TOO_LARGE");
    expect(classifyAiError({ status: 503 }).message).toBe("AI_PROVIDER_UNAVAILABLE");
  });
});
