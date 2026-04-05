import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ToolCategoryFilter } from "@/components/tools/tool-category-filter";

const mockCategories = [
  { id: "1", name: "文本生成", slug: "text-generation", description: null, icon: "✍️", parent_id: null, order: 1, created_at: "" },
  { id: "2", name: "图像生成", slug: "image-generation", description: null, icon: "🎨", parent_id: null, order: 2, created_at: "" },
  { id: "3", name: "编程助手", slug: "coding-assistant", description: null, icon: "💻", parent_id: null, order: 3, created_at: "" },
];

describe("ToolCategoryFilter", () => {
  it("renders all categories", () => {
    render(
      <ToolCategoryFilter
        categories={mockCategories}
        activeSlug={null}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText("文本生成")).toBeInTheDocument();
    expect(screen.getByText("图像生成")).toBeInTheDocument();
    expect(screen.getByText("编程助手")).toBeInTheDocument();
  });

  it("renders 全部 option", () => {
    render(
      <ToolCategoryFilter
        categories={mockCategories}
        activeSlug={null}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText("全部")).toBeInTheDocument();
  });

  it("highlights active category", () => {
    render(
      <ToolCategoryFilter
        categories={mockCategories}
        activeSlug="text-generation"
        onSelect={() => {}}
      />
    );
    const activeBtn = screen.getByText("文本生成").closest("button");
    expect(activeBtn?.className).toContain("bg-muted");
  });

  it("calls onSelect when clicking a category", () => {
    const onSelect = vi.fn();
    render(
      <ToolCategoryFilter
        categories={mockCategories}
        activeSlug={null}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByText("图像生成"));
    expect(onSelect).toHaveBeenCalledWith("image-generation");
  });

  it("calls onSelect with null when clicking 全部", () => {
    const onSelect = vi.fn();
    render(
      <ToolCategoryFilter
        categories={mockCategories}
        activeSlug="text-generation"
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByText("全部"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
