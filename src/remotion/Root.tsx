import React from "react";
import { Composition } from "remotion";
import { ClipComposition, type ClipCompositionProps } from "./ClipComposition";

const DEFAULT_PROPS: ClipCompositionProps = {
  videoSrc: "",
  startSec: 0,
  endSec: 30,
  captions: [],
  captionStyle: "hormozi",
  withCaptions: false,
  captionPosition: "bottom",
  captionSize: "md",
  aspectRatio: "9:16",
};

const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ClipComposition"
      component={ClipComposition as unknown as React.ComponentType<Record<string, unknown>>}
      durationInFrames={900}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={DEFAULT_PROPS as unknown as Record<string, unknown>}
      calculateMetadata={({ props }) => {
        const p = props as unknown as ClipCompositionProps;
        const durationSec = p.endSec - p.startSec;
        const dims = ASPECT_RATIO_DIMENSIONS[p.aspectRatio ?? "9:16"] ?? ASPECT_RATIO_DIMENSIONS["9:16"];
        return {
          durationInFrames: Math.max(1, Math.round(durationSec * 30)),
          width: dims.width,
          height: dims.height,
          props,
        };
      }}
    />
  );
};
