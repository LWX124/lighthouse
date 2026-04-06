import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { UserMenu } from "@/components/layout/user-menu";

describe("UserMenu", () => {
  const defaultProps = {
    email: "test@example.com",
    isPro: false,
    onSignOut: vi.fn(),
  };

  it("renders user email initial as avatar", () => {
    render(<UserMenu {...defaultProps} />);
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("shows Pro badge when isPro is true", () => {
    render(<UserMenu {...defaultProps} isPro={true} />);
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  it("does not show Pro badge when isPro is false", () => {
    render(<UserMenu {...defaultProps} isPro={false} />);
    expect(screen.queryByText("Pro")).not.toBeInTheDocument();
  });

  it("shows dropdown items on click", () => {
    render(<UserMenu {...defaultProps} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("退出登录")).toBeInTheDocument();
  });

  it("calls onSignOut when sign out is clicked", () => {
    const onSignOut = vi.fn();
    render(<UserMenu {...defaultProps} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("退出登录"));
    expect(onSignOut).toHaveBeenCalled();
  });
});
