"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isAdmin } from "@/lib/admin";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isAdmin(userId)) {
      router.replace("/dashboard");
    }
  }, [isLoaded, userId, router]);

  if (!isLoaded || !isAdmin(userId)) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Checking access…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center gap-6 px-6 py-4 border-b border-gray-800">
        <span className="font-bold text-lg">Admin</span>
        <nav className="flex items-center gap-4 text-sm text-gray-400">
          <a href="/admin" className="hover:text-white transition-colors">
            Overview
          </a>
          <a href="/admin/users" className="hover:text-white transition-colors">
            Users
          </a>
          <a href="/admin/projects" className="hover:text-white transition-colors">
            Projects
          </a>
        </nav>
        <a
          href="/dashboard"
          className="ml-auto text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Dashboard
        </a>
      </header>
      <main className="px-6 py-8 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
