"use client";

import dynamic from "next/dynamic";
import type { ClipRemotionPlayerInnerProps } from "./ClipRemotionPlayerInner";

const ClipRemotionPlayerInner = dynamic(
  () =>
    import("./ClipRemotionPlayerInner").then((m) => ({
      default: m.ClipRemotionPlayerInner,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[9/16] bg-gray-900 rounded-xl animate-pulse" />
    ),
  }
);

export function ClipRemotionPlayer(props: ClipRemotionPlayerInnerProps) {
  return <ClipRemotionPlayerInner {...props} />;
}
