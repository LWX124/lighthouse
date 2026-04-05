import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CategorySidebar } from "@/components/tutorials/category-sidebar";

const mockCategories = [
  {
    id: "1",
    name: "AI出海教程",
    slug: "ai-overseas",
    description: null,
    icon: "🌏",
    parent_id: null,
    order: 1,
    created_at: "",
  },
  {
    id: "2",
    name: "OpenClaw 教程",
    slug: "openclaw",
    description: null,
    icon: "🦞",
    parent_id: null,
    order: 2,
    created_at: "",
  },
];

describe("CategorySidebar", () => {
  it("renders category names", () => {
    render(<CategorySidebar categories={mockCategories} />);
    expect(screen.getByText("AI出海教程")).toBeInTheDocument();
    expect(screen.getByText("OpenClaw 教程")).toBeInTheDocument();
  });

  it("renders category icons", () => {
    render(<CategorySidebar categories={mockCategories} />);
    expect(screen.getByText("🌏")).toBeInTheDocument();
    expect(screen.getByText("🦞")).toBeInTheDocument();
  });

  it("highlights active category", () => {
    render(
      <CategorySidebar categories={mockCategories} activeSlug="ai-overseas" />
    );
    const activeLink = screen.getByText("AI出海教程").closest("a");
    expect(activeLink).toHaveClass("text-primary");
  });
});
