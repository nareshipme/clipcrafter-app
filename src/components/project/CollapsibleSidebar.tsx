"use client";

import React from "react";
import { StatusData } from "./types";

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition-colors min-h-[44px]"
      >
        <span>{title}</span>
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function HowItRanSection({
  data,
  open,
  onToggle,
}: {
  data: StatusData;
  open: boolean;
  onToggle: () => void;
}) {
  if (!data.processing_log?.length) return null;
  return (
    <CollapsibleSection title="⚙️ How it ran" open={open} onToggle={onToggle}>
      <div className="flex flex-col gap-2 pt-1">
        {data.processing_log.map((entry, i) => (
          <div key={i} className="flex items-start gap-3 text-sm">
            <span
              className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${entry.status === "ok" ? "bg-green-500" : entry.status === "fallback" ? "bg-yellow-500" : "bg-red-500"}`}
            />
            <div className="flex-1 min-w-0">
              <span className="text-gray-300 font-medium capitalize">{entry.step}</span>
              {entry.provider && (
                <span className="ml-2 text-violet-400 text-xs font-mono">{entry.provider}</span>
              )}
              {entry.detail && (
                <span className="ml-2 text-gray-500 text-xs truncate">{entry.detail}</span>
              )}
            </div>
            <span className="text-gray-600 text-xs shrink-0">
              {new Date(entry.ts).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

export interface CollapsibleSidebarProps {
  data: StatusData;
  howItRanOpen: boolean;
  onToggleHowItRan: () => void;
}

export function CollapsibleSidebar({
  data,
  howItRanOpen,
  onToggleHowItRan,
}: CollapsibleSidebarProps) {
  return <HowItRanSection data={data} open={howItRanOpen} onToggle={onToggleHowItRan} />;
}
