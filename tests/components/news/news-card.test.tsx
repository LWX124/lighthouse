import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { NewsCard } from "@/components/news/news-card";

const mockNewsItem = {
  id: "1",
  source_id: "src-1",
  title: "Claude 4.5 发布：代码生成能力大幅提升",
  url: "https://example.com/claude-4-5",
  summary: "Anthropic 发布 Claude 4.5，在多项编程基准测试中取得突破",
  content: null,
  ai_tags: ["claude", "llm", "coding"],
  ai_summary: "Claude 4.5 在 SWE-bench 测试中达到新高",
  engagement_score: 342,
  status: "approved" as const,
  published_at: "2026-04-05T10:00:00Z",
  created_at: "2026-04-05T10:00:00Z",
};

describe("NewsCard", () => {
  it("renders news title", () => {
    render(<NewsCard item={mockNewsItem} sourceName="HackerNews" />);
    expect(screen.getByText("Claude 4.5 发布：代码生成能力大幅提升")).toBeInTheDocument();
  });

  it("renders AI summary when available", () => {
    render(<NewsCard item={mockNewsItem} sourceName="HackerNews" />);
    expect(screen.getByText("Claude 4.5 在 SWE-bench 测试中达到新高")).toBeInTheDocument();
  });

  it("falls back to summary when no AI summary", () => {
    const item = { ...mockNewsItem, ai_summary: null };
    render(<NewsCard item={item} sourceName="HackerNews" />);
    expect(screen.getByText(/Anthropic 发布 Claude 4.5/)).toBeInTheDocument();
  });

  it("renders source name", () => {
    render(<NewsCard item={mockNewsItem} sourceName="HackerNews" />);
    expect(screen.getByText("HackerNews")).toBeInTheDocument();
  });

  it("renders AI tags", () => {
    render(<NewsCard item={mockNewsItem} sourceName="HackerNews" />);
    expect(screen.getByText("claude")).toBeInTheDocument();
    expect(screen.getByText("llm")).toBeInTheDocument();
  });

  it("renders engagement score", () => {
    render(<NewsCard item={mockNewsItem} sourceName="HackerNews" />);
    expect(screen.getByText(/342/)).toBeInTheDocument();
  });

  it("links to external URL", () => {
    render(<NewsCard item={mockNewsItem} sourceName="HackerNews" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.com/claude-4-5");
  });
});
