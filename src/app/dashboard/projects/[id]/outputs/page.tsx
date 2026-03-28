"use client";

import { useProjectContext } from "@/components/project/ProjectContext";
import { DownloadsPanel } from "@/components/project/DownloadsPanel";
import type { Artifact } from "@/components/project/types";

function artifactIcon(key: string): string {
  if (key === "video") return "🎬";
  if (key === "audio") return "🎵";
  if (key === "transcript") return "📝";
  return "✨";
}

function ArtifactLinks({ artifacts }: { artifacts: Record<string, Artifact> }) {
  const available = Object.entries(artifacts).filter(([, art]) => art.available);
  if (available.length === 0) return null;
  return (
    <section>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Source Files
      </p>
      <div className="flex flex-wrap gap-2">
        {available.map(([key, art]) => (
          <a
            key={key}
            href={art.url}
            download={key === "transcript" || key === "highlights" ? `${key}.json` : undefined}
            target={key === "video" || key === "audio" ? "_blank" : undefined}
            rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-white transition-colors border border-gray-700"
          >
            <span>{artifactIcon(key)}</span>
            <span>{art.label}</span>
            <span className="text-gray-500 text-xs">↓</span>
          </a>
        ))}
      </div>
    </section>
  );
}

export default function OutputsPage() {
  const p = useProjectContext();

  if (p.loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="h-8 w-36 bg-gray-800 rounded animate-pulse" />
        <div className="h-24 bg-gray-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!p.data || !p.isCompleted) {
    return <div className="p-6 text-gray-400 text-sm">Complete processing to view outputs.</div>;
  }

  return (
    <div className="px-4 sm:px-6 py-6 flex flex-col gap-8">
      {p.artifacts && Object.keys(p.artifacts).length > 0 && (
        <ArtifactLinks artifacts={p.artifacts} />
      )}

      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Clip Exports
        </p>
        <DownloadsPanel
          clips={p.clips ?? []}
          projectTitle={p.data.title}
          stitchUrl={p.data.stitch_url}
        />
      </section>
    </div>
  );
}
