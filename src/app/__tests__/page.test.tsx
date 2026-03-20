import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Home from "../page";

describe("Landing page", () => {
  it("displays ClipCrafter headline", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /clipcrafter/i })
    ).toBeInTheDocument();
  });

  it("displays tagline", () => {
    render(<Home />);
    expect(
      screen.getByText(/ai-powered video tools for creators/i)
    ).toBeInTheDocument();
  });

  it("has Get Started CTA linking to /sign-up", () => {
    render(<Home />);
    const link = screen.getByRole("link", { name: /get started/i });
    expect(link).toHaveAttribute("href", "/sign-up");
  });

  it("has Sign In CTA linking to /sign-in", () => {
    render(<Home />);
    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link).toHaveAttribute("href", "/sign-in");
  });

  it("shows Trim feature card", () => {
    render(<Home />);
    expect(screen.getByText("Trim")).toBeInTheDocument();
  });

  it("shows Transcribe feature card", () => {
    render(<Home />);
    expect(screen.getByText("Transcribe")).toBeInTheDocument();
  });

  it("shows Highlight feature card", () => {
    render(<Home />);
    expect(screen.getByText("Highlight")).toBeInTheDocument();
  });

  it("shows Export feature card", () => {
    render(<Home />);
    expect(screen.getByText("Export")).toBeInTheDocument();
  });
});
