import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div data-testid="clerk-user-button" />,
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import DashboardPage from "../page";

const mockProjects = [
  {
    id: "proj-1",
    title: "First Video",
    status: "completed",
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: "proj-2",
    title: "Second Video",
    status: "processing",
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe("Dashboard page", () => {
  it("displays ClipCrafter logo in header", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projects: [], total: 0 }),
    });
    render(<DashboardPage />);
    expect(screen.getByText("ClipCrafter")).toBeInTheDocument();
  });

  it("renders the Clerk UserButton", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projects: [], total: 0 }),
    });
    render(<DashboardPage />);
    expect(screen.getByTestId("clerk-user-button")).toBeInTheDocument();
  });

  it("shows a New Project button", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projects: [], total: 0 }),
    });
    render(<DashboardPage />);
    expect(screen.getByRole("button", { name: /new project/i })).toBeInTheDocument();
  });

  it("shows empty state when no projects are returned", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projects: [], total: 0 }),
    });
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
    });
  });

  it("fetches and displays project cards", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projects: mockProjects, total: 2 }),
    });
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("First Video")).toBeInTheDocument();
      expect(screen.getByText("Second Video")).toBeInTheDocument();
    });
  });

  it("opens the upload modal when New Project is clicked", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projects: [], total: 0 }),
    });
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole("button", { name: /new project/i }));
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /upload file/i })).toBeInTheDocument();
    });
  });

  it("calls GET /api/projects on mount", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projects: [], total: 0 }),
    });
    render(<DashboardPage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/projects");
    });
  });
});
