"use client";

import { useState } from "react";

export interface ModerationItem {
  id: string;
  title: string;
  meta: string;
  badge: "pending" | "approved" | "rejected" | "active" | "dismissed";
}

interface ModerationTableProps {
  items: ModerationItem[];
  onApprove: (ids: string[]) => void;
  onReject: (ids: string[]) => void;
}

const BADGE_STYLES: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  approved: "bg-green-500/10 text-green-500",
  active: "bg-green-500/10 text-green-500",
  rejected: "bg-red-500/10 text-red-500",
  dismissed: "bg-red-500/10 text-red-500",
};

const BADGE_LABELS: Record<string, string> = {
  pending: "待审核",
  approved: "已通过",
  active: "已通过",
  rejected: "已拒绝",
  dismissed: "已拒绝",
};

export function ModerationTable({
  items,
  onApprove,
  onReject,
}: ModerationTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(items.map((i) => i.id)));
  };

  const clearSelection = () => setSelected(new Set());

  return (
    <div className="space-y-3">
      {/* Bulk actions */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={selectAll}
          className="rounded border px-2 py-1 hover:bg-accent"
        >
          全选
        </button>
        {selected.size > 0 && (
          <>
            <span className="text-muted-foreground">
              已选 {selected.size} 条
            </span>
            <button
              onClick={() => {
                onApprove([...selected]);
                clearSelection();
              }}
              className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700"
            >
              批量通过
            </button>
            <button
              onClick={() => {
                onReject([...selected]);
                clearSelection();
              }}
              className="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700"
            >
              批量拒绝
            </button>
          </>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            暂无内容
          </p>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="h-4 w-4 rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.meta}</p>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-xs ${BADGE_STYLES[item.badge] ?? ""}`}
                >
                  {BADGE_LABELS[item.badge] ?? item.badge}
                </span>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => onApprove([item.id])}
                    className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                  >
                    通过
                  </button>
                  <button
                    onClick={() => onReject([item.id])}
                    className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                  >
                    拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
