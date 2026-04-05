import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SourceFilter } from "@/components/news/source-filter";

const mockSources = [
  { id: "1", name: "HackerNews", type: "hn" as const, config: {}, fetch_interval: 7200, is_active: true, created_at: "" },
  { id: "2", name: "Product Hunt", type: "ph" as const, config: {}, fetch_interval: 86400, is_active: true, created_at: "" },
  { id: "3", name: "Reddit", type: "reddit" as const, config: {}, fetch_interval: 7200, is_active: true, created_at: "" },
];

describe("SourceFilter", () => {
  it("renders 全部 pill", () => {
    render(
      <SourceFilter sources={mockSources} activeSourceId={null} onSelect={() => {}} />
    );
    expect(screen.getByText("全部")).toBeInTheDocument();
  });

  it("renders all source names", () => {
    render(
      <SourceFilter sources={mockSources} activeSourceId={null} onSelect={() => {}} />
    );
    expect(screen.getByText(/HackerNews/)).toBeInTheDocument();
    expect(screen.getByText(/Product Hunt/)).toBeInTheDocument();
    expect(screen.getByText(/Reddit/)).toBeInTheDocument();
  });

  it("highlights active source", () => {
    render(
      <SourceFilter sources={mockSources} activeSourceId="1" onSelect={() => {}} />
    );
    const activeBtn = screen.getByText(/HackerNews/).closest("button");
    expect(activeBtn?.className).toContain("bg-primary");
  });

  it("calls onSelect when clicking a source", () => {
    const onSelect = vi.fn();
    render(
      <SourceFilter sources={mockSources} activeSourceId={null} onSelect={onSelect} />
    );
    fireEvent.click(screen.getByText(/Product Hunt/));
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("calls onSelect with null when clicking 全部", () => {
    const onSelect = vi.fn();
    render(
      <SourceFilter sources={mockSources} activeSourceId="1" onSelect={onSelect} />
    );
    fireEvent.click(screen.getByText("全部"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
