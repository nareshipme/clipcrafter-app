export interface Artifact {
  url: string;
  label: string;
  available: boolean;
}

export type ProjectStatus =
  | "pending"
  | "processing"
  | "extracting_audio"
  | "transcribing"
  | "generating_highlights"
  | "completed"
  | "failed";

export interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface ProcessingLogEntry {
  step: string;
  provider?: string;
  detail?: string;
  status: "ok" | "error" | "fallback";
  ts: string;
}

export interface StatusData {
  id: string;
  title: string;
  status: ProjectStatus;
  error_message: string | null;
  completed_at: string | null;
  processing_log: ProcessingLogEntry[];
  transcript: { id: string; segments: Segment[] } | null;
  highlights: { id: string; segments: unknown[] } | null;
  stitch_url?: string | null;
}

export interface Clip {
  id: string;
  project_id: string;
  title: string | null;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  score: number;
  score_reason: string | null;
  status: "pending" | "approved" | "rejected" | "exporting" | "exported";
  caption_style: string;
  aspect_ratio: string;
  export_url: string | null;
  hashtags: string[];
  clip_title: string | null;
  topic: string | null;
}

export type CaptionStyle = "hormozi" | "modern" | "neon" | "minimal";

export const TERMINAL_STATUSES: ProjectStatus[] = ["completed", "failed"];
