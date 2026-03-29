import { supabaseAdmin } from "./supabase";

interface LogAiUsageArgs {
  projectId?: string;
  userId?: string;
  stage: "transcribe" | "highlights" | "export" | "stitch";
  provider?: "sarvam" | "modal" | "gemini" | "remotion";
  status: "success" | "error";
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  audioSeconds?: number;
  errorMessage?: string;
}

export async function logAiUsage(args: LogAiUsageArgs): Promise<void> {
  try {
    await supabaseAdmin.from("ai_usage_logs").insert({
      project_id: args.projectId ?? null,
      user_id: args.userId ?? null,
      stage: args.stage,
      provider: args.provider ?? null,
      status: args.status,
      duration_ms: args.durationMs ?? null,
      input_tokens: args.inputTokens ?? null,
      output_tokens: args.outputTokens ?? null,
      audio_seconds: args.audioSeconds ?? null,
      error_message: args.errorMessage ?? null,
    });
  } catch {
    // Never throw — logging must not break the pipeline
    console.warn("[aiUsageLogger] Failed to log AI usage:", args.stage);
  }
}
