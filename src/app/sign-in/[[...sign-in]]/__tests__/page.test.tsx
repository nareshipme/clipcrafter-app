import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({
  SignIn: () => <div data-testid="clerk-sign-in" />,
}));

import SignInPage from "../page";

describe("Sign-in page", () => {
  it("renders the Clerk SignIn component", () => {
    render(<SignInPage />);
    expect(screen.getByTestId("clerk-sign-in")).toBeInTheDocument();
  });
});
