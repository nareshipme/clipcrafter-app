import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock heavy subcomponents that aren't the focus of these tests
vi.mock("@/components/project/PlayerSection", () => ({
  PlayerSection: () => <div data-testid="player-section" />,
}));
vi.mock("@/components/project/CompletedSidebar", () => ({
  CompletedSidebar: () => <div data-testid="completed-sidebar" />,
}));
vi.mock("@/components/project/CollapsibleSidebar", () => ({
  CollapsibleSidebar: () => <div data-testid="collapsible-sidebar" />,
}));
vi.mock("@/components/project/GraphView", () => ({
  GraphView: () => <div data-testid="graph-view" />,
}));

// Use vi.hoisted so the variable is available when vi.mock factory runs (mocks are hoisted)
const mockUseProjectData = vi.hoisted(() => vi.fn());
vi.mock("@/components/project/useProjectData", () => ({
  useProjectData: mockUseProjectData,
}));

// Import the inner testable component after mocks are declared
import { ProjectDetailContent } from "../page";

function makeHookResult(overrides: Partial<{ status: string; errorMessage: string | null }> = {}) {
  const status = overrides.status ?? "completed";
  const noop = () => {};
  const asyncNoop = async () => {};
  return {
    data: status
      ? {
          id: "proj-test-123",
          title: "Test Project",
          status,
          error_message: overrides.errorMessage ?? null,
          completed_at: status === "completed" ? new Date().toISOString() : null,
          processing_log: [],
          transcript: null,
          highlights: null,
        }
      : null,
    loading: false,
    artifacts: null,
    clips: null,
    clipsStatus: "idle",
    selectedTopic: null,
    setSelectedTopic: noop,
    selectedClipId: null,
    setSelectedClipId: noop,
    clipCount: "auto" as const,
    setClipCount: noop,
    clipPrompt: "",
    setClipPrompt: noop,
    clipTargetDuration: "",
    setClipTargetDuration: noop,
    selectedClipIds: new Set<string>(),
    setSelectedClipIds: noop,
    withCaptions: false,
    setWithCaptions: noop,
    videoRef: { current: null },
    timelineRef: { current: null },
    duration: 0,
    setDuration: noop,
    currentTime: 0,
    setCurrentTime: noop,
    isPlaying: false,
    setIsPlaying: noop,
    isLooping: false,
    setIsLooping: noop,
    showCaptions: false,
    setShowCaptions: noop,
    isPreviewing: false,
    videoUrl: null,
    isYouTube: false,
    youTubeVideoId: null,
    transcriptOpen: false,
    setTranscriptOpen: noop,
    downloadsOpen: false,
    setDownloadsOpen: noop,
    howItRanOpen: false,
    setHowItRanOpen: noop,
    viewMode: "list" as const,
    topicOverrides: {},
    setTopicOverrides: noop,
    handleRetry: asyncNoop,
    handleDelete: asyncNoop,
    handleGenerateClips: asyncNoop,
    handleClipAction: asyncNoop,
    handleExportClip: asyncNoop,
    handleExportBatch: asyncNoop,
    togglePlay: noop,
    seekToClip: noop,
    skipPrev: noop,
    skipNext: noop,
    handlePlayAll: noop,
    stopPreviewing: noop,
    handleTimeUpdate: noop,
    handleLoadedMetadata: noop,
    handleTimelineClick: noop,
    handleHandleMouseDown: noop,
    switchView: noop,
    updateTopicLabel: noop,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseProjectData.mockReturnValue(makeHookResult());
});

describe("ProjectDetailPage", () => {
  it("shows a back button linking to /dashboard", async () => {
    mockUseProjectData.mockReturnValue(makeHookResult({ status: "completed" }));
    render(<ProjectDetailContent id="proj-test-123" />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute("href", "/dashboard");
    });
  });

  it("shows the status badge for a completed project", async () => {
    mockUseProjectData.mockReturnValue(makeHookResult({ status: "completed" }));
    render(<ProjectDetailContent id="proj-test-123" />);
    await waitFor(() => {
      expect(screen.getByTestId("status-badge")).toHaveTextContent("completed");
    });
  });

  it("shows processing stepper when project is in processing state", async () => {
    mockUseProjectData.mockReturnValue(makeHookResult({ status: "processing" }));
    render(<ProjectDetailContent id="proj-test-123" />);
    await waitFor(() => {
      expect(screen.getByTestId("processing-stepper")).toBeInTheDocument();
    });
  });

  it("does not show processing stepper for a completed project", async () => {
    mockUseProjectData.mockReturnValue(makeHookResult({ status: "completed" }));
    render(<ProjectDetailContent id="proj-test-123" />);
    await waitFor(() => {
      expect(screen.getByTestId("status-badge")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("processing-stepper")).not.toBeInTheDocument();
  });

  it("shows error message and retry button for failed project", async () => {
    mockUseProjectData.mockReturnValue(
      makeHookResult({ status: "failed", errorMessage: "Transcription failed" })
    );
    render(<ProjectDetailContent id="proj-test-123" />);
    await waitFor(() => {
      expect(screen.getByText("Transcription failed")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });

  it("shows all 5 processing stages in the stepper", async () => {
    mockUseProjectData.mockReturnValue(makeHookResult({ status: "processing" }));
    render(<ProjectDetailContent id="proj-test-123" />);
    await waitFor(() => {
      expect(screen.getByText(/downloading video/i)).toBeInTheDocument();
      expect(screen.getByText(/extracting audio/i)).toBeInTheDocument();
      expect(screen.getByText(/transcribing/i)).toBeInTheDocument();
      expect(screen.getByText(/generating highlights/i)).toBeInTheDocument();
      expect(screen.getByText(/finalizing/i)).toBeInTheDocument();
    });
  });

  it("does not register a polling interval for a completed project", async () => {
    // With useProjectData mocked, the component itself doesn't set up any intervals
    // The hook's polling is tested separately in usePollingEffects tests
    const intervalDelays: number[] = [];
    const originalSetInterval = global.setInterval;
    vi.spyOn(global, "setInterval").mockImplementation((fn: TimerHandler, delay?: number) => {
      intervalDelays.push(delay ?? 0);
      return originalSetInterval(fn as () => void, delay);
    });

    mockUseProjectData.mockReturnValue(makeHookResult({ status: "completed" }));
    render(<ProjectDetailContent id="proj-test-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("status-badge")).toBeInTheDocument();
    });

    // The page component itself should not register any 3-second intervals
    expect(intervalDelays).not.toContain(3000);

    vi.restoreAllMocks();
  });
});
