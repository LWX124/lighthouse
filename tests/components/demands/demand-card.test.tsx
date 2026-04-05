import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DemandCard } from "@/components/demands/demand-card";

const mockSignal = {
  id: "1",
  news_item_id: "n1",
  signal_type: "pain_point" as const,
  score: 91,
  market_size_est: "大型 ($100M+)",
  competition_lvl: "high" as const,
  ai_analysis: "企业 AI ROI 追踪是一个高分痛点",
  status: "active" as const,
  created_at: "2026-04-01T00:00:00Z",
};

const mockNewsTitle = "企业 AI 采用率达到 78%";

describe("DemandCard", () => {
  it("renders signal type label", () => {
    render(<DemandCard signal={mockSignal} newsTitle={mockNewsTitle} />);
    expect(screen.getByText("痛点需求")).toBeInTheDocument();
  });

  it("renders score", () => {
    render(<DemandCard signal={mockSignal} newsTitle={mockNewsTitle} />);
    expect(screen.getByText("91")).toBeInTheDocument();
  });

  it("renders AI analysis", () => {
    render(<DemandCard signal={mockSignal} newsTitle={mockNewsTitle} />);
    expect(screen.getByText(/企业 AI ROI 追踪/)).toBeInTheDocument();
  });

  it("renders market size", () => {
    render(<DemandCard signal={mockSignal} newsTitle={mockNewsTitle} />);
    expect(screen.getByText(/大型/)).toBeInTheDocument();
  });

  it("renders competition level", () => {
    render(<DemandCard signal={mockSignal} newsTitle={mockNewsTitle} />);
    expect(screen.getByText("竞争: 高")).toBeInTheDocument();
  });

  it("renders related news title", () => {
    render(<DemandCard signal={mockSignal} newsTitle={mockNewsTitle} />);
    expect(screen.getByText(/企业 AI 采用率/)).toBeInTheDocument();
  });

  it("renders solution_req type label correctly", () => {
    const signal = { ...mockSignal, signal_type: "solution_req" as const };
    render(<DemandCard signal={signal} newsTitle={mockNewsTitle} />);
    expect(screen.getByText("方案需求")).toBeInTheDocument();
  });

  it("renders trending type label correctly", () => {
    const signal = { ...mockSignal, signal_type: "trending" as const };
    render(<DemandCard signal={signal} newsTitle={mockNewsTitle} />);
    expect(screen.getByText("趋势需求")).toBeInTheDocument();
  });
});
