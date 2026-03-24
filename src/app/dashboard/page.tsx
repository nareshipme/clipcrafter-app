"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import ProjectCard, { type Project } from "@/components/ProjectCard";
import UploadModal from "@/components/UploadModal";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  async function fetchProjects() {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjects();
  }, []);

  async function handleRetry(id: string) {
    await fetch(`/api/projects/${id}/process`, { method: "POST" });
    fetchProjects();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
    }
  }

  function handleModalClose() {
    setModalOpen(false);
    fetchProjects();
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-800">
        <span className="text-lg sm:text-xl font-bold">ClipCrafter</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 transition-colors min-h-[44px]"
          >
            New Project
          </button>
          <UserButton />
        </div>
      </header>

      <main className="px-4 sm:px-6 py-8 max-w-6xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-36 animate-pulse"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="max-w-sm w-full">
              <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-10 h-10 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
                  />
                </svg>
              </div>
              <h2 className="text-white font-bold text-xl mb-2">No projects yet</h2>
              <p className="text-gray-400 mb-6 text-sm">
                Upload your first video to get started with AI-powered highlight extraction.
              </p>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="w-full sm:w-auto rounded-lg bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-500 transition-colors min-h-[44px]"
              >
                Upload your first video
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onRetry={handleRetry}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      <UploadModal open={modalOpen} onClose={handleModalClose} />
    </div>
  );
}
