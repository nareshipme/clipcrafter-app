import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Unwrap params Promise in tests
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    use: (promise: Promise<unknown>) => {
      // For tests, synchronously return a resolved value by throwing if needed
      if (promise && typeof (promise as { _value?: unknown })._value !== "undefined") {
        return (promise as { _value: unknown })._value;
      }
      // Return a default params object for testing
      return { id: "proj-test-123" };
    },
  };
});

import ProjectDetailPage from "../page";

function makeParams(id: string): Promise<{ id: string }> {
  const p = Promise.resolve({ id }) as Promise<{ id: string }> & { _value: { id: string } };
  (p as { _value: { id: string } })._value = { id };
  return p;
}

const completedProject = {
  id: "proj-test-123",
  status: "completed",
  error_message: null,
  completed_at: new Date().toISOString(),
};

const processingProject = {
  id: "proj-test-123",
  status: "processing",
  error_message: null,
  completed_at: null,
};

const failedProject = {
  id: "proj-test-123",
  status: "failed",
  error_message: "Transcription failed",
  completed_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ProjectDetailPage", () => {
  it("shows a back button linking to /dashboard", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => completedProject,
    });
    render(<ProjectDetailPage params={makeParams("proj-test-123")} />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute("href", "/dashboard");
    });
  });

  it("shows the status badge for a completed project", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => completedProject,
    });
    render(<ProjectDetailPage params={makeParams("proj-test-123")} />);
    await waitFor(() => {
      expect(screen.getByTestId("status-badge")).toHaveTextContent("completed");
    });
  });

  it("shows processing stepper when project is in processing state", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => processingProject,
    });
    render(<ProjectDetailPage params={makeParams("proj-test-123")} />);
    await waitFor(() => {
      expect(screen.getByTestId("processing-stepper")).toBeInTheDocument();
    });
  });

  it("polls status every 3 seconds while processing", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => processingProject,
    });
    render(<ProjectDetailPage params={makeParams("proj-test-123")} />);

    // Wait for initial fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Advance 3 seconds
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it("shows error message and retry button for failed project", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => failedProject,
    });
    render(<ProjectDetailPage params={makeParams("proj-test-123")} />);
    await waitFor(() => {
      expect(screen.getByText("Transcription failed")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });

  it("shows the 5-step stepper with correct active step for processing status", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => processingProject,
    });
    render(<ProjectDetailPage params={makeParams("proj-test-123")} />);
    await waitFor(() => {
      expect(screen.getByText(/downloading video/i)).toBeInTheDocument();
      expect(screen.getByText(/extracting audio/i)).toBeInTheDocument();
      expect(screen.getByText(/transcribing/i)).toBeInTheDocument();
      expect(screen.getByText(/generating highlights/i)).toBeInTheDocument();
      expect(screen.getByText(/finalizing/i)).toBeInTheDocument();
    });
  });

  it("stops polling when project reaches completed status", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => processingProject })
      .mockResolvedValue({ ok: true, json: async () => completedProject });

    render(<ProjectDetailPage params={makeParams("proj-test-123")} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    await act(async () => { vi.advanceTimersByTime(3000); });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    // Now completed — another 3s should not trigger a new fetch
    const callsAfterComplete = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(3000); });
    await waitFor(() => {
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAfterComplete);
    });
  });
});
