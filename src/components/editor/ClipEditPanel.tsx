"use client";

import React from "react";
import type { ClipEditorState } from "./useClipEditor";

// ── Chip group ────────────────────────────────────────────────────────────────

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              value === opt
                ? "bg-violet-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Export button ─────────────────────────────────────────────────────────────

function ExportButton({
  status,
  exporting,
  clipId,
  onExport,
}: {
  status: ClipEditorState["clipStatus"];
  exporting: boolean;
  clipId: string;
  onExport: () => void;
}) {
  if (status === "exported") {
    return (
      <a
        href={`/api/clips/${clipId}/download`}
        download
        className="block w-full py-2.5 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded-lg text-center transition-colors"
      >
        ↓ Download
      </a>
    );
  }
  if (exporting || status === "exporting") {
    return (
      <button
        type="button"
        disabled
        className="w-full py-2.5 bg-gray-700 text-gray-400 text-sm font-semibold rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
          <path
            strokeLinecap="round"
            d="M4 12a8 8 0 018-8"
            strokeWidth="4"
            className="opacity-75"
          />
        </svg>
        Rendering…
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onExport}
      className="w-full py-2.5 bg-violet-700 hover:bg-violet-600 text-white text-sm font-semibold rounded-lg transition-colors"
    >
      Export Clip →
    </button>
  );
}

// ── Section components ────────────────────────────────────────────────────────

function TimingInputs({
  startSec,
  endSec,
  setStartSec,
  setEndSec,
  setCurrentTime,
  schedulePatch,
}: Pick<
  ClipEditorState,
  "startSec" | "endSec" | "setStartSec" | "setEndSec" | "setCurrentTime" | "schedulePatch"
>) {
  return (
    <div className="flex gap-3">
      <div className="flex-1">
        <label className="block text-xs text-gray-500 mb-1.5">Start (s)</label>
        <input
          type="number"
          value={startSec.toFixed(1)}
          step={0.1}
          min={0}
          max={endSec - 0.5}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v < endSec - 0.5) {
              setStartSec(v);
              setCurrentTime(v);
            }
          }}
          onBlur={() => schedulePatch({ start_sec: startSec })}
          className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 font-mono"
        />
      </div>
      <div className="flex-1">
        <label className="block text-xs text-gray-500 mb-1.5">End (s)</label>
        <input
          type="number"
          value={endSec.toFixed(1)}
          step={0.1}
          min={startSec + 0.5}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v > startSec + 0.5) setEndSec(v);
          }}
          onBlur={() => schedulePatch({ end_sec: endSec })}
          className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 font-mono"
        />
      </div>
    </div>
  );
}

function CaptionSection({
  captionPosition,
  captionSize,
  setCaptionPosition,
  setCaptionSize,
}: Pick<
  ClipEditorState,
  "captionPosition" | "captionSize" | "setCaptionPosition" | "setCaptionSize"
>) {
  return (
    <div className="border-t border-gray-800 pt-4 flex flex-col gap-3">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
        Caption Style (preview)
      </p>
      <ChipGroup
        label="Position"
        options={["top", "center", "bottom"] as const}
        value={captionPosition}
        onChange={setCaptionPosition}
      />
      <ChipGroup
        label="Size"
        options={["sm", "md", "lg"] as const}
        value={captionSize}
        onChange={setCaptionSize}
      />
    </div>
  );
}

const CROP_MODES = [
  { value: "contain" as const, label: "Fit", desc: "Show full video" },
  { value: "cover" as const, label: "Fill", desc: "Auto-crop center" },
  { value: "face" as const, label: "Face", desc: "Crop, anchor top" },
  { value: "custom" as const, label: "Custom", desc: "Manual zoom/pan" },
];

type CropSectionProps = Pick<
  ClipEditorState,
  | "cropMode"
  | "cropX"
  | "cropY"
  | "cropZoom"
  | "setCropMode"
  | "setCropX"
  | "setCropY"
  | "setCropZoom"
>;

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-violet-500"
      />
    </div>
  );
}

function CropSection({
  cropMode,
  cropX,
  cropY,
  cropZoom,
  setCropMode,
  setCropX,
  setCropY,
  setCropZoom,
}: CropSectionProps) {
  return (
    <div className="border-t border-gray-800 pt-4 flex flex-col gap-3">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Video Framing</p>
      <div className="grid grid-cols-2 gap-2">
        {CROP_MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setCropMode(m.value)}
            className={`py-2 px-3 rounded-lg text-left transition-colors ${cropMode === m.value ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
          >
            <div className="text-xs font-semibold">{m.label}</div>
            <div className="text-[10px] opacity-70">{m.desc}</div>
          </button>
        ))}
      </div>
      {cropMode === "custom" && (
        <div className="flex flex-col gap-3 mt-1">
          <Slider
            label="Zoom"
            value={cropZoom}
            min={1}
            max={3}
            step={0.05}
            display={`${cropZoom.toFixed(1)}×`}
            onChange={setCropZoom}
          />
          <Slider
            label="Pan X"
            value={cropX}
            min={0}
            max={100}
            step={1}
            display={`${cropX}%`}
            onChange={(v) => setCropX(Math.round(v))}
          />
          <Slider
            label="Pan Y"
            value={cropY}
            min={0}
            max={100}
            step={1}
            display={`${cropY}%`}
            onChange={(v) => setCropY(Math.round(v))}
          />
        </div>
      )}
    </div>
  );
}

function ExportSection({
  format,
  exporting,
  clipStatus,
  clipId,
  setFormat,
  schedulePatch,
  handleExport,
}: Pick<
  ClipEditorState,
  "format" | "exporting" | "clipStatus" | "schedulePatch" | "handleExport" | "setFormat"
> & { clipId: string }) {
  return (
    <div className="border-t border-gray-800 pt-4 flex flex-col gap-3">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Export</p>
      <ChipGroup
        label="Format"
        options={["9:16", "16:9"] as const}
        value={format}
        onChange={(f) => {
          setFormat(f);
          schedulePatch({ aspect_ratio: f });
        }}
      />
      <ExportButton
        status={clipStatus}
        exporting={exporting}
        clipId={clipId}
        onExport={handleExport}
      />
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface ClipEditPanelProps {
  projectId: string;
  clipId: string;
  editor: ClipEditorState;
}

export function ClipEditPanel({ clipId, editor }: ClipEditPanelProps) {
  const { title, setTitle, schedulePatch } = editor;
  return (
    <div className="lg:w-[40%] lg:overflow-y-auto p-4 flex flex-col gap-5 border-t border-gray-800 lg:border-t-0 lg:border-l">
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => schedulePatch({ clip_title: title })}
          className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
          placeholder="Clip title"
        />
      </div>
      <TimingInputs
        startSec={editor.startSec}
        endSec={editor.endSec}
        setStartSec={editor.setStartSec}
        setEndSec={editor.setEndSec}
        setCurrentTime={editor.setCurrentTime}
        schedulePatch={editor.schedulePatch}
      />
      <CaptionSection
        captionPosition={editor.captionPosition}
        captionSize={editor.captionSize}
        setCaptionPosition={editor.setCaptionPosition}
        setCaptionSize={editor.setCaptionSize}
      />
      <CropSection
        cropMode={editor.cropMode}
        cropX={editor.cropX}
        cropY={editor.cropY}
        cropZoom={editor.cropZoom}
        setCropMode={editor.setCropMode}
        setCropX={editor.setCropX}
        setCropY={editor.setCropY}
        setCropZoom={editor.setCropZoom}
      />
      <ExportSection
        format={editor.format}
        exporting={editor.exporting}
        clipStatus={editor.clipStatus}
        clipId={clipId}
        setFormat={editor.setFormat}
        schedulePatch={editor.schedulePatch}
        handleExport={editor.handleExport}
      />
    </div>
  );
}
