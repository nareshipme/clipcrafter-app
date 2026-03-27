import { describe, it, expect, vi, beforeEach } from "vitest";
import { Feature, Scenario } from "@/test/bdd";

// Mock fetch for all LLM calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeChatResponse(content: string) {
  return {
    ok: true,
    text: async () => content,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  };
}

Feature("callLLM — provider-agnostic LLM wrapper", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  Scenario("Gemini provider returns text", () => {
    it("Given LLM_PROVIDER=gemini, Then callLLM returns the assistant content", async () => {
      vi.stubEnv("LLM_PROVIDER", "gemini");
      vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
      vi.stubEnv("LLM_MODEL", "gemini-test-model");

      mockFetch.mockResolvedValue(makeChatResponse("Hello from Gemini"));

      const { callLLM } = await import("@/lib/llm");
      const result = await callLLM("Say hello");

      expect(result).toBe("Hello from Gemini");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/chat/completions"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("Given LLM_PROVIDER=gemini, Then Authorization header uses Bearer token", async () => {
      vi.stubEnv("LLM_PROVIDER", "gemini");
      vi.stubEnv("GEMINI_API_KEY", "my-gemini-key");
      vi.stubEnv("LLM_MODEL", "gemini-test-model");

      mockFetch.mockResolvedValue(makeChatResponse("ok"));

      const { callLLM } = await import("@/lib/llm");
      await callLLM("test prompt");

      const [, fetchOptions] = mockFetch.mock.calls[0];
      const headers = fetchOptions.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer my-gemini-key");
    });
  });

  Scenario("Sarvam provider uses api-subscription-key header", () => {
    it("Given LLM_PROVIDER=sarvam, Then api-subscription-key header is set", async () => {
      vi.stubEnv("LLM_PROVIDER", "sarvam");
      vi.stubEnv("SARVAM_API_KEY", "my-sarvam-key");
      vi.stubEnv("LLM_MODEL", "sarvam-m");

      mockFetch.mockResolvedValue(makeChatResponse("ok"));

      const { callLLM } = await import("@/lib/llm");
      await callLLM("test prompt");

      const [, fetchOptions] = mockFetch.mock.calls[0];
      const headers = fetchOptions.headers as Record<string, string>;
      expect(headers["api-subscription-key"]).toBe("my-sarvam-key");
      expect(headers["Authorization"]).toBeUndefined();
    });
  });

  Scenario("callLLM throws when API returns non-ok response", () => {
    it("Given a 500 response, Then callLLM throws with status info", async () => {
      vi.stubEnv("LLM_PROVIDER", "gemini");
      vi.stubEnv("GEMINI_API_KEY", "key");
      vi.stubEnv("LLM_MODEL", "gemini-test-model");

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const { callLLM } = await import("@/lib/llm");
      await expect(callLLM("test")).rejects.toThrow("LLM call failed");
    });
  });

  Scenario("callLLM throws when API returns empty content", () => {
    it("Given a response with no content, Then callLLM throws", async () => {
      vi.stubEnv("LLM_PROVIDER", "gemini");
      vi.stubEnv("GEMINI_API_KEY", "key");
      vi.stubEnv("LLM_MODEL", "gemini-test-model");

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "" } }] }),
      });

      const { callLLM } = await import("@/lib/llm");
      await expect(callLLM("test")).rejects.toThrow("empty content");
    });
  });
});

Feature("parseLLMJson — strip markdown fences and parse JSON", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  Scenario("Plain JSON string", () => {
    it("Given a plain JSON array, Then it parses correctly", async () => {
      const { parseLLMJson } = await import("@/lib/llm");
      const result = parseLLMJson<{ a: number }[]>('[{"a": 1}]');
      expect(result).toEqual([{ a: 1 }]);
    });
  });

  Scenario("JSON wrapped in markdown fences", () => {
    it("Given json markdown wrapper, Then it strips fences and parses", async () => {
      const { parseLLMJson } = await import("@/lib/llm");
      const raw = '```json\n[{"start": 0, "end": 10}]\n```';
      const result = parseLLMJson<{ start: number; end: number }[]>(raw);
      expect(result).toEqual([{ start: 0, end: 10 }]);
    });

    it("Given plain backtick wrapper, Then it strips fences and parses", async () => {
      const { parseLLMJson } = await import("@/lib/llm");
      const raw = '```\n{"key": "val"}\n```';
      const result = parseLLMJson<Record<string, string>>(raw);
      expect(result).toEqual({ key: "val" });
    });
  });

  Scenario("Invalid JSON throws", () => {
    it("Given malformed JSON, Then it throws a SyntaxError", async () => {
      const { parseLLMJson } = await import("@/lib/llm");
      expect(() => parseLLMJson("not valid json")).toThrow(SyntaxError);
    });
  });
});
