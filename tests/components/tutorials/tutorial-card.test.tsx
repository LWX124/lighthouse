import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TutorialCard } from "@/components/tutorials/tutorial-card";

const mockTutorial = {
  id: "1",
  category_id: "cat-1",
  title: "AI出海第一步：市场调研方法",
  slug: "ai-overseas-market-research",
  content: "",
  summary: "学习如何通过系统化的市场调研方法找到最佳切入点",
  order: 1,
  is_free: true,
  status: "published" as const,
  read_time_minutes: 15,
  view_count: 1200,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

describe("TutorialCard", () => {
  it("renders tutorial title", () => {
    render(<TutorialCard tutorial={mockTutorial} categorySlug="ai-overseas" />);
    expect(screen.getByText("AI出海第一步：市场调研方法")).toBeInTheDocument();
  });

  it("renders summary", () => {
    render(<TutorialCard tutorial={mockTutorial} categorySlug="ai-overseas" />);
    expect(screen.getByText(/系统化的市场调研/)).toBeInTheDocument();
  });

  it("renders read time", () => {
    render(<TutorialCard tutorial={mockTutorial} categorySlug="ai-overseas" />);
    expect(screen.getByText(/15 分钟/)).toBeInTheDocument();
  });

  it("shows free badge for free tutorials", () => {
    render(<TutorialCard tutorial={mockTutorial} categorySlug="ai-overseas" />);
    expect(screen.getByText("免费")).toBeInTheDocument();
  });
});
