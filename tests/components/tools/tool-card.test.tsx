import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ToolCard } from "@/components/tools/tool-card";

const mockTool = {
  id: "1",
  name: "ChatGPT",
  slug: "chatgpt",
  url: "https://chat.openai.com",
  description: "OpenAI 的对话式 AI 助手",
  logo_url: null,
  category_id: "cat-1",
  pricing_model: "freemium" as const,
  features: [],
  tags: ["chatbot", "writing"],
  verified: true,
  status: "published" as const,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

const mockRanking = {
  id: "r1",
  tool_id: "1",
  period: "2026-04",
  monthly_visits: 1800000000,
  growth_rate: 2.3,
  rank: 1,
  category_rank: 1,
  created_at: "2026-04-01",
};

describe("ToolCard", () => {
  it("renders tool name", () => {
    render(<ToolCard tool={mockTool} ranking={mockRanking} />);
    expect(screen.getByText("ChatGPT")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<ToolCard tool={mockTool} ranking={mockRanking} />);
    expect(screen.getByText("OpenAI 的对话式 AI 助手")).toBeInTheDocument();
  });

  it("renders pricing model badge", () => {
    render(<ToolCard tool={mockTool} ranking={mockRanking} />);
    expect(screen.getByText("freemium")).toBeInTheDocument();
  });

  it("renders rank number", () => {
    render(<ToolCard tool={mockTool} ranking={mockRanking} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
  });

  it("renders monthly visits formatted", () => {
    render(<ToolCard tool={mockTool} ranking={mockRanking} />);
    expect(screen.getByText(/18.0 亿/)).toBeInTheDocument();
  });

  it("renders growth rate with arrow", () => {
    render(<ToolCard tool={mockTool} ranking={mockRanking} />);
    expect(screen.getByText(/2.3%/)).toBeInTheDocument();
  });

  it("renders without ranking gracefully", () => {
    render(<ToolCard tool={mockTool} />);
    expect(screen.getByText("ChatGPT")).toBeInTheDocument();
  });

  it("shows verified badge when verified", () => {
    render(<ToolCard tool={mockTool} ranking={mockRanking} />);
    expect(screen.getByText("✓")).toBeInTheDocument();
  });
});
