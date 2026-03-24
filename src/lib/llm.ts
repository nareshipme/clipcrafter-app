/**
 * Provider-agnostic LLM text generation.
 *
 * All providers are called via the OpenAI-compatible chat completions API.
 * Gemini is accessed through Google's OpenAI-compatible endpoint so no
 * provider-specific SDK is needed.
 *
 * Config (env vars):
 *   LLM_PROVIDER   = gemini | openai | openrouter | sarvam | custom
 *                    default: gemini
 *   LLM_MODEL      = model name for the chosen provider
 *                    default per provider:
 *                      gemini     → gemini-2.0-flash
 *                      openai     → gpt-4o-mini
 *                      openrouter → google/gemini-2.0-flash
 *                      sarvam     → sarvam-m
 *   LLM_API_KEY    = API key (for non-Gemini providers)
 *                    Gemini uses GEMINI_API_KEY
 *   LLM_BASE_URL   = override base URL (e.g. local Ollama, custom proxy)
 *
 * Usage:
 *   import { callLLM } from "@/lib/llm";
 *   const result = await callLLM("Your prompt here");
 */

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

// Fallback chains per provider — tried in order until one succeeds
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; defaultModel: string }> = {
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "google/gemini-2.0-flash",
  },
  sarvam: {
    baseUrl: "https://api.sarvam.ai/v1",
    defaultModel: "sarvam-m",
  },
};

function getConfig() {
  const provider = (process.env.LLM_PROVIDER ?? "gemini").toLowerCase();
  const defaults = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.gemini;

  const model = process.env.LLM_MODEL ?? defaults.defaultModel;
  const baseUrl = process.env.LLM_BASE_URL ?? defaults.baseUrl;

  // API key: LLM_API_KEY takes precedence; fall back to Gemini key for gemini provider
  const apiKey =
    process.env.LLM_API_KEY ??
    (provider === "gemini" ? process.env.GEMINI_API_KEY : undefined) ??
    (provider === "sarvam" ? process.env.SARVAM_API_KEY : undefined) ??
    "";

  return { provider, model, baseUrl, apiKey };
}

async function callLLMWithModel(
  model: string,
  prompt: string,
  opts: LLMOptions,
  baseUrl: string,
  apiKey: string,
  provider: string
): Promise<string> {
  const messages: Array<{ role: string; content: string }> = [];
  if (opts.systemPrompt) messages.push({ role: "system", content: opts.systemPrompt });
  messages.push({ role: "user", content: prompt });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider === "sarvam") {
    headers["api-subscription-key"] = apiKey;
  } else {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const body: Record<string, unknown> = { model, messages, temperature: opts.temperature ?? 0.3 };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000), // 5 min — long transcripts need time
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM call failed (${provider}/${model} ${res.status}): ${err.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`LLM returned empty content (${provider}/${model})`);

  console.log(`[llm] ${provider}/${model} → ${content.length} chars`);
  return content;
}

export async function callLLM(prompt: string, opts: LLMOptions = {}): Promise<string> {
  const { model, baseUrl, apiKey, provider } = getConfig();

  // For Gemini, try fallback chain if configured model fails
  const models = provider === "gemini" ? [...new Set([model, ...GEMINI_MODELS])] : [model];

  let lastErr: Error | null = null;
  for (const m of models) {
    try {
      return await callLLMWithModel(m, prompt, opts, baseUrl, apiKey, provider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const retryable =
        msg.includes("404") ||
        msg.includes("deprecated") ||
        msg.includes("not found") ||
        msg.includes("no longer available") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("quota");
      console.warn(`[llm] ${provider}/${m} failed: ${msg.slice(0, 120)}`);
      lastErr = err instanceof Error ? err : new Error(msg);
      if (!retryable) throw lastErr;
    }
  }
  throw lastErr ?? new Error(`All ${provider} models failed`);
}

/** Convenience: parse JSON from LLM output, stripping markdown fences */
export function parseLLMJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
