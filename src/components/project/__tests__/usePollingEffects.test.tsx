import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useStatusPolling } from "../usePollingEffects";

describe("useStatusPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls fetchStatus immediately on mount", () => {
    const fetchStatus = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useStatusPolling({ data: null, fetchStatus }));
    expect(fetchStatus).toHaveBeenCalledOnce();
  });

  it("does not set up a polling interval when data is null", () => {
    const fetchStatus = vi.fn().mockResolvedValue(undefined);
    const setIntervalSpy = vi.spyOn(global, "setInterval");

    renderHook(() => useStatusPolling({ data: null, fetchStatus }));

    // setInterval should not be called for polling (only fetchStatus once via useEffect)
    const pollingCalls = setIntervalSpy.mock.calls.filter(([, delay]) => delay === 3000);
    expect(pollingCalls).toHaveLength(0);
  });

  it("does not set up polling when status is completed (terminal)", () => {
    const fetchStatus = vi.fn().mockResolvedValue(undefined);
    const setIntervalSpy = vi.spyOn(global, "setInterval");

    renderHook(() =>
      useStatusPolling({
        data: {
          id: "p1",
          status: "completed",
          error_message: null,
          completed_at: null,
          processing_log: [],
          transcript: null,
          highlights: null,
        },
        fetchStatus,
      })
    );

    const pollingCalls = setIntervalSpy.mock.calls.filter(([, delay]) => delay === 3000);
    expect(pollingCalls).toHaveLength(0);
  });

  it("sets up a 3-second polling interval for in-progress status", () => {
    const fetchStatus = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useStatusPolling({
        data: {
          id: "p1",
          status: "processing",
          error_message: null,
          completed_at: null,
          processing_log: [],
          transcript: null,
          highlights: null,
        },
        fetchStatus,
      })
    );

    // Advance timer by 3 seconds — fetchStatus should be called again
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Called once on mount + once after 3s
    expect(fetchStatus.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
