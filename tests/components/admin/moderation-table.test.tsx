import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ModerationTable } from "@/components/admin/moderation-table";

const mockItems = [
  {
    id: "1",
    title: "News Item 1",
    meta: "HackerNews · 2026-04-06",
    badge: "pending" as const,
  },
  {
    id: "2",
    title: "News Item 2",
    meta: "Reddit · 2026-04-05",
    badge: "pending" as const,
  },
];

describe("ModerationTable", () => {
  it("renders items in the list", () => {
    render(
      <ModerationTable
        items={mockItems}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText("News Item 1")).toBeInTheDocument();
    expect(screen.getByText("News Item 2")).toBeInTheDocument();
  });

  it("calls onApprove with item id when approve button clicked", () => {
    const onApprove = vi.fn();
    render(
      <ModerationTable
        items={mockItems}
        onApprove={onApprove}
        onReject={vi.fn()}
      />
    );
    const approveButtons = screen.getAllByText("通过");
    fireEvent.click(approveButtons[0]);
    expect(onApprove).toHaveBeenCalledWith(["1"]);
  });

  it("calls onReject with item id when reject button clicked", () => {
    const onReject = vi.fn();
    render(
      <ModerationTable
        items={mockItems}
        onApprove={vi.fn()}
        onReject={onReject}
      />
    );
    const rejectButtons = screen.getAllByText("拒绝");
    fireEvent.click(rejectButtons[0]);
    expect(onReject).toHaveBeenCalledWith(["1"]);
  });

  it("selects all items when 全选 is clicked", () => {
    const onApprove = vi.fn();
    render(
      <ModerationTable
        items={mockItems}
        onApprove={onApprove}
        onReject={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("全选"));
    fireEvent.click(screen.getByText("批量通过"));
    expect(onApprove).toHaveBeenCalledWith(["1", "2"]);
  });
});
