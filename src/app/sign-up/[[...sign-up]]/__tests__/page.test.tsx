import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({
  SignUp: () => <div data-testid="clerk-sign-up" />,
}));

import SignUpPage from "../page";

describe("Sign-up page", () => {
  it("renders the Clerk SignUp component", () => {
    render(<SignUpPage />);
    expect(screen.getByTestId("clerk-sign-up")).toBeInTheDocument();
  });
});
