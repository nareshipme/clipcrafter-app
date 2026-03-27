import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProcessingStatus } from "../ProcessingStatus";

describe("ProcessingStatus", () => {
  describe("processing state", () => {
    it("shows the stepper when status is processing", () => {
      render(<ProcessingStatus status="processing" errorMessage={null} onRetry={vi.fn()} />);
      expect(screen.getByTestId("processing-stepper")).toBeInTheDocument();
    });

    it("shows the stepper when status is transcribing", () => {
      render(<ProcessingStatus status="transcribing" errorMessage={null} onRetry={vi.fn()} />);
      expect(screen.getByTestId("processing-stepper")).toBeInTheDocument();
    });

    it("shows all 5 stage labels", () => {
      render(<ProcessingStatus status="processing" errorMessage={null} onRetry={vi.fn()} />);
      expect(screen.getByText(/downloading video/i)).toBeInTheDocument();
      expect(screen.getByText(/extracting audio/i)).toBeInTheDocument();
      expect(screen.getByText(/transcribing/i)).toBeInTheDocument();
      expect(screen.getByText(/generating highlights/i)).toBeInTheDocument();
      expect(screen.getByText(/finalizing/i)).toBeInTheDocument();
    });

    it("highlights the active stage for extracting_audio", () => {
      render(<ProcessingStatus status="extracting_audio" errorMessage={null} onRetry={vi.fn()} />);
      const extractingItem = screen.getByText(/extracting audio/i);
      expect(extractingItem).toHaveClass("text-yellow-400");
    });
  });

  describe("failed state", () => {
    it("shows error message and retry button when status is failed", () => {
      const mockRetry = vi.fn();
      render(
        <ProcessingStatus status="failed" errorMessage="Transcription failed" onRetry={mockRetry} />
      );
      expect(screen.getByText("Transcription failed")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    it("calls onRetry when retry button is clicked", () => {
      const mockRetry = vi.fn();
      render(<ProcessingStatus status="failed" errorMessage={null} onRetry={mockRetry} />);
      fireEvent.click(screen.getByRole("button", { name: /retry/i }));
      expect(mockRetry).toHaveBeenCalledOnce();
    });

    it("does not show stepper when status is failed", () => {
      render(<ProcessingStatus status="failed" errorMessage={null} onRetry={vi.fn()} />);
      expect(screen.queryByTestId("processing-stepper")).not.toBeInTheDocument();
    });
  });

  describe("pending state", () => {
    it("shows queued message for pending status", () => {
      render(<ProcessingStatus status="pending" errorMessage={null} onRetry={vi.fn()} />);
      expect(screen.getByText(/queued/i)).toBeInTheDocument();
    });

    it("does not show stepper or error for pending status", () => {
      render(<ProcessingStatus status="pending" errorMessage={null} onRetry={vi.fn()} />);
      expect(screen.queryByTestId("processing-stepper")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    });
  });

  describe("completed state", () => {
    it("does not show stepper or failed state when completed", () => {
      render(<ProcessingStatus status="completed" errorMessage={null} onRetry={vi.fn()} />);
      expect(screen.queryByTestId("processing-stepper")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    });
  });
});
