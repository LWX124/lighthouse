import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RankingTabs } from "@/components/tools/ranking-tabs";

describe("RankingTabs", () => {
  it("renders all tab options", () => {
    render(<RankingTabs activeTab="monthly" onTabChange={() => {}} />);
    expect(screen.getByText("月度榜")).toBeInTheDocument();
    expect(screen.getByText("增长榜")).toBeInTheDocument();
    expect(screen.getByText("新工具")).toBeInTheDocument();
  });

  it("highlights active tab", () => {
    render(<RankingTabs activeTab="growth" onTabChange={() => {}} />);
    const activeBtn = screen.getByText("增长榜").closest("button");
    expect(activeBtn?.className).toContain("border-primary");
  });

  it("calls onTabChange when clicking a tab", () => {
    const onTabChange = vi.fn();
    render(<RankingTabs activeTab="monthly" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText("增长榜"));
    expect(onTabChange).toHaveBeenCalledWith("growth");
  });

  it("does not re-fire onTabChange for already active tab", () => {
    const onTabChange = vi.fn();
    render(<RankingTabs activeTab="monthly" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText("月度榜"));
    expect(onTabChange).not.toHaveBeenCalled();
  });
});
