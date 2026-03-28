"use client";

import { useEffect } from "react";
import { useProjectContext } from "@/components/project/ProjectContext";
import { CollapsibleSidebar } from "@/components/project/CollapsibleSidebar";

export default function InsightsPage() {
  const p = useProjectContext();

  useEffect(() => {
    p.setTranscriptOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    return <div className="p-6 text-gray-400 text-sm">Complete processing to view insights.</div>;
  }

  return (
    <div className="px-4 sm:px-6 py-6 flex flex-col gap-6">
      <h2 className="text-xl font-bold text-white">Transcript</h2>
      {/* Transcript and "How it ran" — pass null artifacts to suppress the Downloads section */}
      <CollapsibleSidebar
        data={p.data}
        artifacts={null}
        clips={[]}
        transcriptOpen={p.transcriptOpen}
        downloadsOpen={false}
        howItRanOpen={p.howItRanOpen}
        onToggleTranscript={() => p.setTranscriptOpen((o) => !o)}
        onToggleDownloads={() => {}}
        onToggleHowItRan={() => p.setHowItRanOpen((o) => !o)}
      />
    </div>
  );
}
