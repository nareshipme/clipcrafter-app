/**
 * Remotion composition for rendering a video clip with captions.
 * Props are injected at render time by the Inngest export job.
 */
import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, useVideoConfig } from "remotion";

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

// ── Caption position / size presets ──────────────────────────────────────────

const CAPTION_POSITION_STYLES: Record<string, React.CSSProperties> = {
  bottom: {
    justifyContent: "flex-end",
    paddingBottom: "10%",
    paddingLeft: "5%",
    paddingRight: "5%",
  },
  center: { justifyContent: "center", paddingLeft: "5%", paddingRight: "5%" },
  top: {
    justifyContent: "flex-start",
    paddingTop: "10%",
    paddingLeft: "5%",
    paddingRight: "5%",
  },
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
  /**
   * Caption segments — timing must be 0-based ms (clip start = 0ms).
   * Each segment is shown during [startMs, endMs).
   */
  captions: Array<{ startMs: number; endMs: number; text: string }>;
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
  /**
   * Video crop/zoom mode:
   * - "contain": letterbox/pillarbox, full video visible (default)
   * - "cover": auto-crop to fill canvas, centered
   * - "face": crop to fill, anchored to top (keeps faces in frame for portrait)
   * - "custom": use cropX / cropY / cropZoom for manual control
   */
  cropMode?: "contain" | "cover" | "face" | "custom";
  /** Custom crop X position 0–100 (left–right), only used when cropMode="custom" */
  cropX?: number;
  /** Custom crop Y position 0–100 (top–bottom), only used when cropMode="custom" */
  cropY?: number;
  /** Custom zoom level 1–3, only used when cropMode="custom" */
  cropZoom?: number;
}

// ── Single caption renderer ───────────────────────────────────────────────────

function CaptionItem({
  text,
  style,
  captionPosition = "bottom",
}: {
  text: string;
  style: React.CSSProperties;
  captionPosition?: "top" | "center" | "bottom";
}) {
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
        {text}
      </div>
    </AbsoluteFill>
  );
}

// ── Main composition ──────────────────────────────────────────────────────────

function getVideoStyle(
  cropMode: ClipCompositionProps["cropMode"],
  cropX: number,
  cropY: number,
  cropZoom: number
): React.CSSProperties {
  if (cropMode === "contain") {
    return { width: "100%", height: "100%", objectFit: "contain" };
  }
  if (cropMode === "cover") {
    return { width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 50%" };
  }
  if (cropMode === "face") {
    // Anchor to top-center — keeps face/head in frame for portrait videos
    return { width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 15%" };
  }
  // custom: use transform scale + translate for precise zoom/pan
  const scale = Math.max(1, cropZoom);
  const tx = (cropX - 50) * (scale - 1) * -1;
  const ty = (cropY - 50) * (scale - 1) * -1;
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `scale(${scale}) translate(${tx / scale}%, ${ty / scale}%)`,
    transformOrigin: "center center",
  };
}

export const ClipComposition: React.FC<ClipCompositionProps> = ({
  videoSrc,
  startSec,
  endSec,
  captions,
  captionStyle,
  withCaptions,
  captionPosition = "bottom",
  captionSize = "md",
  cropMode = "contain",
  cropX = 50,
  cropY = 50,
  cropZoom = 1,
}) => {
  const { fps } = useVideoConfig();
  const clipDuration = endSec - startSec;

  const baseStyle = CAPTION_STYLES[captionStyle] ?? CAPTION_STYLES.hormozi;
  const style: React.CSSProperties = {
    ...baseStyle,
    fontSize: CAPTION_FONT_SIZES[captionSize] ?? CAPTION_FONT_SIZES.md,
  };

  const videoStyle = getVideoStyle(cropMode, cropX, cropY, cropZoom);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Source video trimmed to clip range */}
      <OffthreadVideo
        src={videoSrc}
        startFrom={Math.round(startSec * fps)}
        endAt={Math.round(endSec * fps)}
        style={videoStyle}
      />

      {/* One Sequence per caption — shown only during [startMs, endMs) */}
      {withCaptions &&
        captions.map((caption, i) => {
          const startFrame = Math.round((caption.startMs / 1000) * fps);
          const endFrame = Math.min(
            Math.round((caption.endMs / 1000) * fps),
            Math.round(clipDuration * fps)
          );
          const duration = Math.max(1, endFrame - startFrame);
          if (startFrame >= Math.round(clipDuration * fps)) return null;

          return (
            <Sequence key={i} from={startFrame} durationInFrames={duration}>
              <CaptionItem text={caption.text} style={style} captionPosition={captionPosition} />
            </Sequence>
          );
        })}
    </AbsoluteFill>
  );
};
