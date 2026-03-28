"use client";

import { useEffect, useState } from "react";
import { useProjectContext } from "@/components/project/ProjectContext";
import { DownloadsPanel } from "@/components/project/DownloadsPanel";
import type { Artifact } from "@/components/project/types";

type StitchedExport = {
  id: string;
  clip_ids: string[];
  export_url: string;
  created_at: string;
};

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

function useStitchedExports(projectId: string, isCompleted: boolean) {
  const [stitchedExports, setStitchedExports] = useState<StitchedExport[]>([]);

  useEffect(() => {
    if (!isCompleted) return;
    fetch(`/api/projects/${projectId}/stitched-exports`)
      .then((r) => r.json())
      .then((d) => setStitchedExports(d.stitchedExports ?? []))
      .catch(() => {});
  }, [projectId, isCompleted]);

  // Poll while there are ongoing stitch jobs
  useEffect(() => {
    if (!isCompleted) return;
    const t = setInterval(() => {
      fetch(`/api/projects/${projectId}/stitched-exports`)
        .then((r) => r.json())
        .then((d) => setStitchedExports(d.stitchedExports ?? []))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [projectId, isCompleted]);

  return stitchedExports;
}

function OutputsContent({ p }: { p: ReturnType<typeof useProjectContext> }) {
  const stitchedExports = useStitchedExports(p.data?.id ?? "", !!p.isCompleted);

  return (
    <div className="px-4 sm:px-6 py-6 flex flex-col gap-8">
      {p.artifacts && Object.keys(p.artifacts).length > 0 && (
        <ArtifactLinks artifacts={p.artifacts} />
      )}

      {stitchedExports.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Stitched Exports
          </p>
          <ul className="flex flex-col gap-2">
            {stitchedExports.map((se, i) => (
              <li key={se.id}>
                <article className="flex items-center gap-3 py-2 px-3 bg-violet-900/40 rounded-lg border border-violet-700">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">
                      Stitch #{stitchedExports.length - i} — {se.clip_ids.length} clips
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(se.created_at).toLocaleString()}
                    </p>
                  </div>
                  <a
                    href={se.export_url}
                    download={`stitch-${i + 1}.mp4`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg text-xs font-semibold text-white transition-colors shrink-0"
                  >
                    ↓ Download
                  </a>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Clip Exports
        </p>
        <DownloadsPanel clips={p.clips ?? []} projectTitle={p.data?.title ?? ""} />
      </section>
    </div>
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

  return <OutputsContent p={p} />;
}
