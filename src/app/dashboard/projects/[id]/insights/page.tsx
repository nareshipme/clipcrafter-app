"use client";

import { useProjectContext } from "@/components/project/ProjectContext";
import { Segment } from "@/components/project/types";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const SPEAKER_COLORS = [
  "text-violet-400",
  "text-blue-400",
  "text-green-400",
  "text-yellow-400",
  "text-pink-400",
];

function TranscriptView({ segments }: { segments: Segment[] }) {
  if (!segments.length) return <p className="text-gray-500 text-sm">No transcript available.</p>;

  return (
    <div className="flex flex-col gap-2">
      {segments.map((seg) => {
        const m = seg.text.match(/^\[Speaker (\d+)\]\s*/);
        const speakerNum = m ? parseInt(m[1]) : null;
        const text = m ? seg.text.slice(m[0].length) : seg.text;
        const color =
          speakerNum !== null
            ? SPEAKER_COLORS[speakerNum % SPEAKER_COLORS.length]
            : "text-gray-400";

        return (
          <div key={seg.id} className="flex gap-3 text-sm">
            <span className="text-gray-500 font-mono text-xs shrink-0 pt-0.5 w-10">
              {formatTime(seg.start)}
            </span>
            {speakerNum !== null && (
              <span className={`text-xs font-bold shrink-0 pt-0.5 w-16 ${color}`}>
                S{speakerNum}
              </span>
            )}
            <p className="text-gray-300 leading-relaxed">{text}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function InsightsPage() {
  const p = useProjectContext();

  if (p.loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
        <div className="h-6 w-full bg-gray-800 rounded animate-pulse" />
        <div className="h-6 w-3/4 bg-gray-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!p.data || !p.isCompleted) {
    return <div className="p-6 text-gray-400 text-sm">Complete processing to view transcript.</div>;
  }

  const segments = (p.data.transcript?.segments ?? []) as Segment[];

  return (
    <div className="px-4 sm:px-6 py-6 flex flex-col gap-8">
      <section>
        <h2 className="text-xl font-bold text-white mb-4">Transcript</h2>
        <TranscriptView segments={segments} />
      </section>
    </div>
  );
}
