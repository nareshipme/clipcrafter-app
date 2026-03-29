/**
 * Remotion composition for rendering a video clip with captions.
 * Props are injected at render time by the Inngest export job.
 */
import React, { useMemo } from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { createTikTokStyleCaptions, type Caption } from "@remotion/captions";

// ── Caption style presets ─────────────────────────────────────────────────────

const CAPTION_STYLES: Record<string, React.CSSProperties> = {
  hormozi: {
    fontSize: 52,
    fontWeight: 900,
    fontFamily: "Impact, Arial Black, sans-serif",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 1,
    WebkitTextStroke: "2px black",
  },
  modern: {
    fontSize: 40,
    fontWeight: 700,
    fontFamily: "Inter, Helvetica Neue, sans-serif",
    color: "#fff",
  },
  neon: {
    fontSize: 44,
    fontWeight: 800,
    fontFamily: "Inter, Helvetica Neue, sans-serif",
    color: "#00ff99",
    textShadow: "0 0 12px #00ff99, 0 0 24px #00ff9966",
  },
  minimal: {
    fontSize: 36,
    fontWeight: 500,
    fontFamily: "Georgia, serif",
    color: "#fff",
  },
};

const HIGHLIGHT_COLORS: Record<string, string> = {
  hormozi: "#FFD700",
  modern: "#7c3aed",
  neon: "#ffffff",
  minimal: "#e2c97e",
};

// ── Caption position / size presets ──────────────────────────────────────────

const CAPTION_POSITION_STYLES: Record<string, React.CSSProperties> = {
  bottom: {
    justifyContent: "flex-end",
    paddingBottom: "10%",
    paddingLeft: "5%",
    paddingRight: "5%",
  },
  center: { justifyContent: "center", paddingLeft: "5%", paddingRight: "5%" },
  top: { justifyContent: "flex-start", paddingTop: "10%", paddingLeft: "5%", paddingRight: "5%" },
};

const CAPTION_FONT_SIZES: Record<string, number> = {
  sm: 24,
  md: 32,
  lg: 44,
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ClipCompositionProps {
  /** Absolute path or R2 presigned URL to the source video */
  videoSrc: string;
  /** Clip start in seconds (into the source video) */
  startSec: number;
  /** Clip end in seconds (into the source video) */
  endSec: number;
  /** Caption segments (already filtered to the clip range) */
  captions: Caption[];
  /** Caption style name */
  captionStyle: "hormozi" | "modern" | "neon" | "minimal";
  /** Whether to show captions */
  withCaptions: boolean;
  /** Vertical position of captions */
  captionPosition?: "top" | "center" | "bottom";
  /** Caption font size preset */
  captionSize?: "sm" | "md" | "lg";
  /** Output aspect ratio */
  aspectRatio?: "9:16" | "16:9" | "1:1";
}

// ── Caption page renderer ─────────────────────────────────────────────────────

const SWITCH_EVERY_MS = 1500;

function CaptionPage({
  page,
  style,
  highlightColor,
  captionPosition = "bottom",
  pageStartMs,
}: {
  page: ReturnType<typeof createTikTokStyleCaptions>["pages"][number];
  style: React.CSSProperties;
  highlightColor: string;
  captionPosition?: "top" | "center" | "bottom";
  pageStartMs: number; // absolute ms from clip start when this Sequence begins
}) {
  const frame = useCurrentFrame(); // 0-based within this Sequence
  const { fps } = useVideoConfig();
  // absoluteMs = where we are in the clip (ms), matching token fromMs/toMs values
  const absoluteMs = pageStartMs + (frame / fps) * 1000;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        ...CAPTION_POSITION_STYLES[captionPosition],
      }}
    >
      <div
        style={{
          textAlign: "center",
          background: "rgba(0,0,0,0.55)",
          borderRadius: 12,
          padding: "10px 20px",
          maxWidth: "85%",
          lineHeight: 1.3,
          ...style,
        }}
      >
        {page.tokens.map((token) => {
          const isActive = token.fromMs <= absoluteMs && token.toMs > absoluteMs;
          return (
            <span
              key={token.fromMs}
              style={{
                color: isActive ? highlightColor : undefined,
                transition: "color 80ms",
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ── Main composition ──────────────────────────────────────────────────────────

export const ClipComposition: React.FC<ClipCompositionProps> = ({
  videoSrc,
  startSec,
  endSec,
  captions,
  captionStyle,
  withCaptions,
  captionPosition = "bottom",
  captionSize = "md",
}) => {
  const { fps } = useVideoConfig();
  const clipDuration = endSec - startSec;

  const { pages } = useMemo(
    () =>
      createTikTokStyleCaptions({
        captions,
        combineTokensWithinMilliseconds: SWITCH_EVERY_MS,
      }),
    [captions]
  );

  const baseStyle = CAPTION_STYLES[captionStyle] ?? CAPTION_STYLES.hormozi;
  const style: React.CSSProperties = {
    ...baseStyle,
    fontSize: CAPTION_FONT_SIZES[captionSize] ?? CAPTION_FONT_SIZES.md,
  };
  const highlightColor = HIGHLIGHT_COLORS[captionStyle] ?? "#FFD700";

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Source video trimmed to clip range */}
      <OffthreadVideo
        src={videoSrc}
        startFrom={Math.round(startSec * fps)}
        endAt={Math.round(endSec * fps)}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />

      {/* Captions overlay */}
      {withCaptions &&
        pages.map((page, i) => {
          const nextPage = pages[i + 1] ?? null;
          // Captions are already 0-based (relative to clip start = 0ms)
          // so page.startMs is directly in clip-relative milliseconds
          const startFrame = Math.round((page.startMs / 1000) * fps);
          const endFrame = nextPage
            ? Math.round((nextPage.startMs / 1000) * fps)
            : Math.round(clipDuration * fps);
          const duration = Math.max(1, endFrame - startFrame);
          if (startFrame >= Math.round(clipDuration * fps)) return null;

          return (
            <Sequence key={i} from={startFrame} durationInFrames={duration}>
              <CaptionPage
                page={page}
                style={style}
                highlightColor={highlightColor}
                captionPosition={captionPosition}
                pageStartMs={page.startMs}
              />
            </Sequence>
          );
        })}
    </AbsoluteFill>
  );
};
