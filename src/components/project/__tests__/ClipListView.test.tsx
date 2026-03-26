import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { ClipListView } from "../ClipListView";
import type { Clip } from "../types";

function makeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: "clip_1",
    project_id: "proj_1",
    title: "Test Clip",
    clip_title: "Test Clip Title",
    start_sec: 10,
    end_sec: 40,
    duration_sec: 30,
    score: 85,
    score_reason: "High impact",
    hashtags: ["#test"],
    status: "pending",
    caption_style: "hormozi" as const,
    aspect_ratio: "9:16" as const,
    topic: "motivation",
    export_url: null,
    ...overrides,
  };
}

const noop = () => {};

function makeProps(overrides: Partial<Parameters<typeof ClipListView>[0]> = {}) {
  return {
    sortedClips: [makeClip()],
    selectedClipId: null,
    selectedClipIds: new Set<string>(),
    selectedTopic: null,
    clipsStatus: "idle",
    clips: [makeClip()],
    withCaptions: false,
    onSetSelectedTopic: noop,
    onSetSelectedClipId: vi.fn(),
    onSeekToClip: vi.fn(),
    onToggleClipCheck: noop,
    onSelectAll: noop,
    onDeselectAll: noop,
    onToggleCaptions: noop,
    onExportBatch: noop,
    onClipAction: vi.fn(),
    onExportClip: vi.fn(),
    onGenerateClips: noop,
    ...overrides,
  };
}

describe("ClipListView", () => {
  it("renders a list of clips", () => {
    render(<ClipListView {...makeProps()} />);
    expect(screen.getByText("Test Clip Title")).toBeInTheDocument();
  });

  it("shows the score badge for each clip", () => {
    render(<ClipListView {...makeProps()} />);
    expect(screen.getByText("85")).toBeInTheDocument();
  });

  it("shows formatted time range for each clip", () => {
    render(<ClipListView {...makeProps()} />);
    // 10s = 0:10, 40s = 0:40
    expect(screen.getByText(/0:10/)).toBeInTheDocument();
  });

  it("calls onSetSelectedClipId when a clip is clicked", () => {
    const mockSelect = vi.fn();
    render(<ClipListView {...makeProps({ onSetSelectedClipId: mockSelect })} />);
    fireEvent.click(screen.getByText("Test Clip Title"));
    expect(mockSelect).toHaveBeenCalledWith("clip_1");
  });

  it("shows score as dash when score is 0", () => {
    render(<ClipListView {...makeProps({ sortedClips: [makeClip({ score: 0 })] })} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("ClipListView — skipped tab", () => {
  it("shows Clips and Skipped tabs", () => {
    render(<ClipListView {...makeProps()} />);
    expect(screen.getByRole("tab", { name: /Clips/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Skipped/i })).toBeInTheDocument();
  });

  it("Clips tab count excludes rejected clips", () => {
    const clips = [
      makeClip({ id: "a", status: "pending" }),
      makeClip({ id: "b", status: "rejected" }),
    ];
    render(<ClipListView {...makeProps({ sortedClips: clips, clips })} />);
    expect(screen.getByRole("tab", { name: /Clips \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Skipped \(1\)/i })).toBeInTheDocument();
  });

  it("rejected clips do not appear in Clips tab", () => {
    const clips = [
      makeClip({ id: "a", clip_title: "Good Clip", status: "pending" }),
      makeClip({ id: "b", clip_title: "Bad Clip", status: "rejected" }),
    ];
    render(<ClipListView {...makeProps({ sortedClips: clips, clips })} />);
    expect(screen.getByText("Good Clip")).toBeInTheDocument();
    expect(screen.queryByText("Bad Clip")).not.toBeInTheDocument();
  });

  it("Skipped tab shows rejected clips with Restore button", () => {
    const clips = [makeClip({ id: "b", clip_title: "Bad Clip", status: "rejected" })];
    render(<ClipListView {...makeProps({ sortedClips: clips, clips })} />);

    // Switch to Skipped tab
    fireEvent.click(screen.getByRole("tab", { name: /Skipped/i }));
    expect(screen.getByText("Bad Clip")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /restore clip/i })).toBeInTheDocument();
  });

  it("Restore button calls onClipAction with status pending", () => {
    const onClipAction = vi.fn();
    const clips = [makeClip({ id: "clip_r", status: "rejected" })];
    render(<ClipListView {...makeProps({ sortedClips: clips, clips, onClipAction })} />);

    fireEvent.click(screen.getByRole("tab", { name: /Skipped/i }));
    fireEvent.click(screen.getByRole("button", { name: /restore clip/i }));
    expect(onClipAction).toHaveBeenCalledWith("clip_r", { status: "pending" });
  });

  it("Skipped tab shows empty state when no skipped clips", () => {
    render(<ClipListView {...makeProps()} />);
    fireEvent.click(screen.getByRole("tab", { name: /Skipped/i }));
    expect(screen.getByText(/No skipped clips/i)).toBeInTheDocument();
  });
});

describe("ClipListView — Stitch & Export button", () => {
  it("does not show Stitch & Export when fewer than 2 clips selected", () => {
    render(
      <ClipListView
        {...makeProps({
          selectedClipIds: new Set(["clip_1"]),
          onStitchExport: vi.fn(),
        })}
      />
    );
    expect(screen.queryByText(/Stitch & Export/i)).not.toBeInTheDocument();
  });

  it("shows Stitch & Export when 2+ clips selected and onStitchExport provided", () => {
    const clips = [makeClip({ id: "a" }), makeClip({ id: "b", clip_title: "Clip B" })];
    render(
      <ClipListView
        {...makeProps({
          sortedClips: clips,
          clips,
          selectedClipIds: new Set(["a", "b"]),
          onStitchExport: vi.fn(),
        })}
      />
    );
    expect(screen.getByText(/Stitch & Export \(2\)/i)).toBeInTheDocument();
  });

  it("calls onStitchExport when Stitch & Export clicked", () => {
    const onStitchExport = vi.fn();
    const clips = [makeClip({ id: "a" }), makeClip({ id: "b", clip_title: "Clip B" })];
    render(
      <ClipListView
        {...makeProps({
          sortedClips: clips,
          clips,
          selectedClipIds: new Set(["a", "b"]),
          onStitchExport,
        })}
      />
    );
    fireEvent.click(screen.getByText(/Stitch & Export/i));
    expect(onStitchExport).toHaveBeenCalled();
  });
});

describe("ClipListView — auto-download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fires toast when a clip transitions to exported", async () => {
    const { toast } = await import("sonner");
    const clip = makeClip({ id: "x", status: "pending" });

    const { rerender } = render(<ClipListView {...makeProps({ clips: [clip] })} />);

    const exportedClip = {
      ...clip,
      status: "exported" as const,
      export_url: "https://r2.example/x.mp4",
    };
    await act(async () => {
      rerender(<ClipListView {...makeProps({ clips: [exportedClip] })} />);
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Clip ready!",
      expect.objectContaining({ description: clip.clip_title })
    );
  });

  it("calls onOpenDownloads when clip transitions to exported", async () => {
    const onOpenDownloads = vi.fn();
    const clip = makeClip({ id: "y", status: "pending" });

    const { rerender } = render(
      <ClipListView {...makeProps({ clips: [clip], onOpenDownloads })} />
    );

    const exportedClip = {
      ...clip,
      status: "exported" as const,
      export_url: "https://r2.example/y.mp4",
    };
    await act(async () => {
      rerender(<ClipListView {...makeProps({ clips: [exportedClip], onOpenDownloads })} />);
    });

    expect(onOpenDownloads).toHaveBeenCalled();
  });
});
