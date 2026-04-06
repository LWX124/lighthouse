import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { UpgradeBanner } from "@/components/pricing/upgrade-banner";

describe("UpgradeBanner", () => {
  it("renders nothing when isPro is true", () => {
    const { container } = render(<UpgradeBanner isPro={true} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders upgrade message when isPro is false", () => {
    render(<UpgradeBanner isPro={false} />);
    expect(screen.getByText(/升级 Pro/)).toBeInTheDocument();
  });

  it("renders upgrade link to pricing page", () => {
    render(<UpgradeBanner isPro={false} />);
    const link = screen.getByRole("link", { name: /升级/ });
    expect(link).toHaveAttribute("href", "/pricing");
  });

  it("renders custom message when provided", () => {
    render(<UpgradeBanner isPro={false} message="今日免费额度已用完" />);
    expect(screen.getByText("今日免费额度已用完")).toBeInTheDocument();
  });
});
