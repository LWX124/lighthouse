import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NavbarAuth } from "@/components/layout/navbar-auth";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("NavbarAuth", () => {
  it("renders login and signup buttons when not authenticated", () => {
    render(<NavbarAuth initialUser={null} isPro={false} />);
    expect(screen.getByText("登录")).toBeInTheDocument();
    expect(screen.getByText("注册")).toBeInTheDocument();
  });

  it("renders user menu when authenticated", () => {
    render(
      <NavbarAuth initialUser={{ email: "test@example.com" }} isPro={false} />
    );
    // Should show user initial, not login/signup
    expect(screen.getByText("T")).toBeInTheDocument();
    expect(screen.queryByText("登录")).not.toBeInTheDocument();
  });

  it("shows Pro badge when isPro is true", () => {
    render(
      <NavbarAuth initialUser={{ email: "test@example.com" }} isPro={true} />
    );
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });
});
