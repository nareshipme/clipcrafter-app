"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectContext } from "@/components/project/ProjectContext";

function DangerZone({ onDelete }: { onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <section className="flex flex-col gap-3 border border-red-900/50 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
      <p className="text-xs text-gray-500">
        Permanently delete this project and all its clips and exports. This cannot be undone.
      </p>
      {!confirmDelete ? (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="self-start px-4 py-2.5 border border-red-700 text-red-400 hover:bg-red-900/30 rounded-lg text-sm font-semibold transition-colors min-h-[44px]"
        >
          Delete project
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-semibold text-white transition-colors min-h-[44px]"
          >
            Yes, delete permanently
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-300 transition-colors min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}

export default function SettingsPage() {
  const p = useProjectContext();
  const router = useRouter();

  if (p.loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
        <div className="h-6 w-full bg-gray-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!p.data) {
    return <div className="p-6 text-gray-400 text-sm">Project not found.</div>;
  }

  async function handleDelete() {
    await p.handleDelete();
    router.push("/dashboard");
  }

  return (
    <div className="px-4 sm:px-6 py-6 flex flex-col gap-8 max-w-xl">
      <h2 className="text-lg font-bold text-white">Settings</h2>
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-gray-300">Source Video</h3>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">
          <p>
            Status: <span className="text-gray-200 font-medium">{p.data.status}</span>
          </p>
          {p.data.completed_at && (
            <p className="mt-1">
              Completed:{" "}
              <span className="text-gray-200">
                {new Date(p.data.completed_at).toLocaleString()}
              </span>
            </p>
          )}
        </div>
      </section>
      {p.data.status === "failed" && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-300">Re-process</h3>
          <button
            type="button"
            onClick={p.handleRetry}
            className="self-start px-4 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-semibold text-white transition-colors min-h-[44px]"
          >
            Retry processing
          </button>
        </section>
      )}
      <DangerZone onDelete={handleDelete} />
    </div>
  );
}
