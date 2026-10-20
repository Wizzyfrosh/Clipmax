import OpenAI from "openai";
import { required } from "../../src/lib/config";

export type AiProvider = "groq" | "openai";
export type AiProviderSettings = {
  name: AiProvider;
  transcriptionModel: string;
  textModel: string;
  maxCompletionTokens: number;
};

/**
 * Provider selection is explicit. Never silently fall back from Groq's
 * free-plan API to a paid OpenAI account on failures or rate limits.
 */
export function aiProviderSettings(): AiProviderSettings {
  const name = process.env.AI_PROVIDER || "openai";
  if (name === "groq") {
    return {
      name,
      transcriptionModel: "whisper-large-v3-turbo",
      textModel: "openai/gpt-oss-20b",
      // Stay below Groq free-plan 8K TPM for small pilot transcripts.
      maxCompletionTokens: 3000,
    };
  }
  if (name === "openai") {
    return {
      name,
      transcriptionModel: "whisper-1",
      textModel: required("TEXT_MODEL"),
      maxCompletionTokens: 6000,
    };
  }
  throw new Error("AI_PROVIDER_UNSUPPORTED");
}

export function aiProviderClient(settings: AiProviderSettings) {
  const groq = settings.name === "groq";
  return new OpenAI({
    apiKey: required(groq ? "GROQ_API_KEY" : "OPENAI_API_KEY"),
    ...(groq ? { baseURL: "https://api.groq.com/openai/v1" } : {}),
    timeout: 180000,
    // Never retry automatically: request limits and ambiguous charges matter.
    maxRetries: 0,
  });
}

/** Safe error codes: never expose provider response, prompt, key, or filename. */
export function classifyAiError(error: unknown): Error {
  if (error instanceof Error && /^AI_|^CONFIG_/.test(error.message)) return error;
  const status = error && typeof error === "object" && "status" in error
    ? (error as { status?: unknown }).status
    : undefined;
  if (status === 429) return new Error("AI_FREE_TIER_LIMIT");
  if (status === 401 || status === 403) return new Error("AI_PROVIDER_AUTH_FAILED");
  if (status === 413) return new Error("TRANSCRIPTION_FILE_TOO_LARGE");
  if (status === 400 || status === 422) return new Error("AI_PROVIDER_INVALID_REQUEST");
  return new Error("AI_PROVIDER_UNAVAILABLE");
}
