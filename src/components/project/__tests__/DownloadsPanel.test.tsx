import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DownloadsPanel } from "../DownloadsPanel";
import type { Clip } from "../types";

function makeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: "clip_1",
    project_id: "proj_1",
    title: "Test Clip",
    clip_title: "My Exported Clip",
    start_sec: 0,
    end_sec: 30,
    duration_sec: 30,
    score: 80,
    score_reason: null,
    hashtags: [],
    status: "exported",
    caption_style: "hormozi",
    aspect_ratio: "9:16",
    export_url: "https://r2.example/clip.mp4",
    topic: null,
    ...overrides,
  };
}

describe("DownloadsPanel", () => {
  it("shows empty state when no exported clips", () => {
    render(<DownloadsPanel clips={[]} projectTitle="My Project" />);
    expect(screen.getByText(/No exports yet/i)).toBeInTheDocument();
  });

  it("shows empty state when clips are pending (not exported)", () => {
    const clip = makeClip({ status: "pending", export_url: null });
    render(<DownloadsPanel clips={[clip]} projectTitle="My Project" />);
    expect(screen.getByText(/No exports yet/i)).toBeInTheDocument();
  });

  it("renders exported clip with title and duration", () => {
    render(<DownloadsPanel clips={[makeClip()]} projectTitle="My Project" />);
    expect(screen.getByText("My Exported Clip")).toBeInTheDocument();
    expect(screen.getByText("30.0s")).toBeInTheDocument();
  });

  it("renders a download link with correct href", () => {
    render(<DownloadsPanel clips={[makeClip()]} projectTitle="My Project" />);
    const link = screen.getByRole("link", { name: /Download My Exported Clip/i });
    expect(link).toHaveAttribute("href", "https://r2.example/clip.mp4");
    expect(link).toHaveAttribute("download", "My Exported Clip.mp4");
  });

  it("falls back to title when clip_title is null", () => {
    const clip = makeClip({ clip_title: null, title: "Fallback Title" });
    render(<DownloadsPanel clips={[clip]} projectTitle="My Project" />);
    expect(screen.getByText("Fallback Title")).toBeInTheDocument();
  });

  it("renders multiple exported clips", () => {
    const clips = [
      makeClip({ id: "a", clip_title: "Clip A" }),
      makeClip({ id: "b", clip_title: "Clip B" }),
    ];
    render(<DownloadsPanel clips={clips} projectTitle="My Project" />);
    expect(screen.getByText("Clip A")).toBeInTheDocument();
    expect(screen.getByText("Clip B")).toBeInTheDocument();
  });

  it("uses section element for accessibility", () => {
    render(<DownloadsPanel clips={[makeClip()]} projectTitle="My Project" />);
    expect(screen.getByRole("region", { name: /Exported clips/i })).toBeInTheDocument();
  });
});
