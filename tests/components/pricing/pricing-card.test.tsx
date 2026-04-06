import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PricingCard } from "@/components/pricing/pricing-card";

describe("PricingCard", () => {
  const freeProps = {
    name: "Free",
    price: 0,
    description: "基础功能",
    features: ["功能 A", "功能 B"],
    isCurrentPlan: true,
    isPro: false,
  };

  const proProps = {
    name: "Pro",
    price: 29,
    description: "全部功能",
    features: ["功能 A", "功能 B", "功能 C"],
    isCurrentPlan: false,
    isPro: false,
    highlighted: true,
  };

  it("renders plan name and price", () => {
    render(<PricingCard {...freeProps} />);
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText(/免费/)).toBeInTheDocument();
  });

  it("renders pro price with currency", () => {
    render(<PricingCard {...proProps} />);
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText(/¥29/)).toBeInTheDocument();
    expect(screen.getByText(/\/月/)).toBeInTheDocument();
  });

  it("renders all features", () => {
    render(<PricingCard {...proProps} />);
    expect(screen.getByText("功能 A")).toBeInTheDocument();
    expect(screen.getByText("功能 B")).toBeInTheDocument();
    expect(screen.getByText("功能 C")).toBeInTheDocument();
  });

  it("shows current plan badge when isCurrentPlan is true", () => {
    render(<PricingCard {...freeProps} />);
    expect(screen.getByText("当前方案")).toBeInTheDocument();
  });

  it("shows upgrade button for non-current pro plan", () => {
    render(<PricingCard {...proProps} />);
    expect(screen.getByRole("button", { name: /升级/ })).toBeInTheDocument();
  });

  it("disables upgrade button when already pro", () => {
    render(<PricingCard {...proProps} isPro={true} isCurrentPlan={true} />);
    expect(screen.queryByRole("button", { name: /升级/ })).not.toBeInTheDocument();
    expect(screen.getByText("当前方案")).toBeInTheDocument();
  });
});
