import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DemandFilters } from "@/components/demands/demand-filters";

describe("DemandFilters", () => {
  it("renders signal type filter buttons", () => {
    render(
      <DemandFilters
        activeType={null}
        sortBy="score"
        onTypeChange={() => {}}
        onSortChange={() => {}}
      />
    );
    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("痛点需求")).toBeInTheDocument();
    expect(screen.getByText("方案需求")).toBeInTheDocument();
    expect(screen.getByText("趋势需求")).toBeInTheDocument();
  });

  it("highlights active type", () => {
    render(
      <DemandFilters
        activeType="pain_point"
        sortBy="score"
        onTypeChange={() => {}}
        onSortChange={() => {}}
      />
    );
    const activeBtn = screen.getByText("痛点需求").closest("button");
    expect(activeBtn?.className).toContain("bg-primary");
  });

  it("calls onTypeChange when clicking a type", () => {
    const onTypeChange = vi.fn();
    render(
      <DemandFilters
        activeType={null}
        sortBy="score"
        onTypeChange={onTypeChange}
        onSortChange={() => {}}
      />
    );
    fireEvent.click(screen.getByText("方案需求"));
    expect(onTypeChange).toHaveBeenCalledWith("solution_req");
  });

  it("renders sort options", () => {
    render(
      <DemandFilters
        activeType={null}
        sortBy="score"
        onTypeChange={() => {}}
        onSortChange={() => {}}
      />
    );
    expect(screen.getByText("按评分")).toBeInTheDocument();
    expect(screen.getByText("按时间")).toBeInTheDocument();
  });

  it("calls onSortChange when clicking sort option", () => {
    const onSortChange = vi.fn();
    render(
      <DemandFilters
        activeType={null}
        sortBy="score"
        onTypeChange={() => {}}
        onSortChange={onSortChange}
      />
    );
    fireEvent.click(screen.getByText("按时间"));
    expect(onSortChange).toHaveBeenCalledWith("date");
  });
});
