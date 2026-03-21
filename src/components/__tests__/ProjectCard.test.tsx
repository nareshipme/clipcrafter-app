import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Feature, Scenario, Then, And } from "@/test/bdd";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import ProjectCard from "../ProjectCard";

const baseProject = {
  id: "proj-123",
  title: "My Test Video",
  status: "pending" as const,
  created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
};

Feature("ProjectCard", () => {
  Scenario("renders project title", () => {
    Then("the project title is visible", () => {
      render(<ProjectCard project={baseProject} />);
      expect(screen.getByText("My Test Video")).toBeInTheDocument();
    });
  });

  Scenario("status badge colors", () => {
    Then("pending status shows a gray badge", () => {
      render(<ProjectCard project={{ ...baseProject, status: "pending" }} />);
      const badge = screen.getByTestId("status-badge");
      expect(badge).toHaveClass("bg-gray-500");
      expect(badge).toHaveTextContent("pending");
    });

    Then("processing status shows a yellow badge", () => {
      render(<ProjectCard project={{ ...baseProject, status: "processing" }} />);
      const badge = screen.getByTestId("status-badge");
      expect(badge).toHaveClass("bg-yellow-500");
      expect(badge).toHaveTextContent("processing");
    });

    Then("extracting_audio status shows a yellow badge", () => {
      render(<ProjectCard project={{ ...baseProject, status: "extracting_audio" }} />);
      const badge = screen.getByTestId("status-badge");
      expect(badge).toHaveClass("bg-yellow-500");
    });

    Then("transcribing status shows a yellow badge", () => {
      render(<ProjectCard project={{ ...baseProject, status: "transcribing" }} />);
      const badge = screen.getByTestId("status-badge");
      expect(badge).toHaveClass("bg-yellow-500");
    });

    Then("generating_highlights status shows a yellow badge", () => {
      render(<ProjectCard project={{ ...baseProject, status: "generating_highlights" }} />);
      const badge = screen.getByTestId("status-badge");
      expect(badge).toHaveClass("bg-yellow-500");
    });

    Then("completed status shows a green badge", () => {
      render(<ProjectCard project={{ ...baseProject, status: "completed" }} />);
      const badge = screen.getByTestId("status-badge");
      expect(badge).toHaveClass("bg-green-500");
      expect(badge).toHaveTextContent("completed");
    });

    Then("failed status shows a red badge", () => {
      render(<ProjectCard project={{ ...baseProject, status: "failed" }} />);
      const badge = screen.getByTestId("status-badge");
      expect(badge).toHaveClass("bg-red-500");
      expect(badge).toHaveTextContent("failed");
    });
  });

  Scenario("relative timestamp", () => {
    Then("shows a relative time string", () => {
      render(<ProjectCard project={baseProject} />);
      expect(screen.getByTestId("project-timestamp")).toBeInTheDocument();
      // Should contain some human-readable time info
      const timestamp = screen.getByTestId("project-timestamp");
      expect(timestamp.textContent).toMatch(/ago|just now|hour|minute|day/i);
    });
  });

  Scenario("View button", () => {
    Then("shows a View button linking to the project page", () => {
      render(<ProjectCard project={baseProject} />);
      const link = screen.getByRole("link", { name: /view/i });
      expect(link).toHaveAttribute("href", "/dashboard/projects/proj-123");
    });
  });

  Scenario("Retry button for failed projects", () => {
    Then("shows Retry button when status is failed", () => {
      render(<ProjectCard project={{ ...baseProject, status: "failed" }} onRetry={vi.fn()} />);
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    And("does not show Retry button for non-failed projects", () => {
      render(<ProjectCard project={{ ...baseProject, status: "completed" }} />);
      expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    });
  });

  Scenario("long title truncation", () => {
    Then("truncates a very long title", () => {
      const longTitle = "A".repeat(100);
      render(<ProjectCard project={{ ...baseProject, title: longTitle }} />);
      const titleEl = screen.getByTestId("project-title");
      expect(titleEl).toHaveClass("truncate");
    });
  });
});
