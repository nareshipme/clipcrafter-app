import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div data-testid="clerk-user-button" />,
}));

import DashboardPage from "../page";

describe("Dashboard page", () => {
  it("displays ClipCrafter logo in header", () => {
    render(<DashboardPage />);
    expect(screen.getByText("ClipCrafter")).toBeInTheDocument();
  });

  it("renders the Clerk UserButton", () => {
    render(<DashboardPage />);
    expect(screen.getByTestId("clerk-user-button")).toBeInTheDocument();
  });

  it("shows empty state message", () => {
    render(<DashboardPage />);
    expect(
      screen.getByText(/no projects yet/i)
    ).toBeInTheDocument();
  });

  it("shows upload button placeholder", () => {
    render(<DashboardPage />);
    expect(
      screen.getByRole("button", { name: /upload a video/i })
    ).toBeInTheDocument();
  });
});
