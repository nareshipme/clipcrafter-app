import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Feature, Scenario, Given, Then } from "@/test/bdd";

// Mock fs with default export (transcribe.ts uses `import fs from "fs"` — CJS default)
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  const mocked = {
    ...actual,
    readFileSync: vi.fn().mockReturnValue(Buffer.from("fake audio data")),
  };
  return { ...mocked, default: mocked };
});

// Each Sarvam transcription runs through 7 fetch calls:
//  1. POST /job/v1             → create job
//  2. POST /upload-files       → get upload URL
//  3. PUT  <upload_url>        → upload file
//  4. POST /{job_id}/start     → start job
//  5. GET  /{job_id}/status    → poll — returns Completed
//  6. POST /download-files     → get download URL
//  7. GET  <download_url>      → transcript JSON

function makeSarvamFetch(outputJson: object) {
  let callCount = 0;
  return vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    callCount++;
    const method = (opts?.method ?? "GET").toUpperCase();

    if (callCount === 1 && method === "POST") {
      // create job
      return Promise.resolve(new Response(JSON.stringify({ job_id: "job_abc" }), { status: 200 }));
    }
    if (callCount === 2 && method === "POST") {
      // upload-files
      return Promise.resolve(
        new Response(
          JSON.stringify({
            upload_urls: { "audio.mp3": { file_url: "https://blob.example.com/audio" } },
          }),
          { status: 200 }
        )
      );
    }
    if (callCount === 3 && method === "PUT") {
      // PUT file to blob
      return Promise.resolve(new Response("OK", { status: 200 }));
    }
    if (callCount === 4 && method === "POST") {
      // start job
      return Promise.resolve(new Response("{}", { status: 200 }));
    }
    if (callCount === 5 && method === "GET") {
      // poll status → Completed
      return Promise.resolve(
        new Response(
          JSON.stringify({
            job_state: "Completed",
            job_details: [{ outputs: [{ file_name: "0.json", file_id: "file_1" }] }],
          }),
          { status: 200 }
        )
      );
    }
    if (callCount === 6 && method === "POST") {
      // download-files
      return Promise.resolve(
        new Response(
          JSON.stringify({
            download_urls: { "0.json": { file_url: "https://blob.example.com/output.json" } },
          }),
          { status: 200 }
        )
      );
    }
    if (callCount === 7 && method === "GET") {
      // transcript output JSON
      return Promise.resolve(new Response(JSON.stringify(outputJson), { status: 200 }));
    }
    return Promise.resolve(new Response(`unexpected call ${callCount}`, { status: 500 }));
  });
}

Feature("transcribeAudio — Sarvam Saaras v3", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubEnv("SARVAM_API_KEY", "test-sarvam-key");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  Scenario("transcribe audio with diarization output", () => {
    Given("a valid audio file path", async () => {
      const { transcribeAudio } = await import("@/lib/transcribe");
      expect(typeof transcribeAudio).toBe("function");
    });

    Then("it returns diarized segments with speaker labels", async () => {
      vi.stubGlobal(
        "fetch",
        makeSarvamFetch({
          diarized_transcript: {
            entries: [
              {
                transcript: "Hello world",
                start_time_seconds: 0,
                end_time_seconds: 2,
                speaker_id: "0",
              },
              {
                transcript: "How are you",
                start_time_seconds: 2.5,
                end_time_seconds: 5,
                speaker_id: "1",
              },
            ],
          },
        })
      );

      const { transcribeAudio } = await import("@/lib/transcribe");
      // pollSarvamJob has sleep(5000) before the first status check — advance fake timers
      const promise = transcribeAudio("/tmp/audio.mp3");
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.text).toContain("[Speaker 0]");
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0]).toMatchObject({ start: 0, end: 2, id: 0 });
      expect(result.provider).toContain("Sarvam");
    });
  });

  Scenario("transcribe audio with timestamp output (no diarization)", () => {
    Then("it groups words into segments and returns text", async () => {
      vi.stubGlobal(
        "fetch",
        makeSarvamFetch({
          transcript: "Hello world how are you",
          timestamps: {
            words: ["Hello", "world", "how", "are", "you"],
            start_time_seconds: [0, 0.5, 1.0, 1.5, 2.0],
            end_time_seconds: [0.4, 0.9, 1.4, 1.9, 2.4],
          },
        })
      );

      const { transcribeAudio } = await import("@/lib/transcribe");
      const promise = transcribeAudio("/tmp/audio.mp3");
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.text).toBe("Hello world how are you");
      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.provider).toContain("Sarvam");
    });
  });

  Scenario("missing SARVAM_API_KEY", () => {
    Then("it throws when API key is absent", async () => {
      vi.unstubAllEnvs();
      vi.stubEnv("SARVAM_API_KEY", "");
      vi.resetModules();

      const { transcribeAudio } = await import("@/lib/transcribe");
      await expect(transcribeAudio("/tmp/audio.mp3")).rejects.toThrow("SARVAM_API_KEY");
    });
  });
});
