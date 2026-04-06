"use client";

import { useEffect, useState } from "react";
import { ModerationTable, type ModerationItem } from "@/components/admin/moderation-table";

type StatusFilter = "pending" | "active" | "dismissed";

const TAB_LABELS: Record<StatusFilter, string> = {
  pending: "待审核",
  active: "已通过",
  dismissed: "已拒绝",
};

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  pain_point: "痛点",
  solution_req: "需求",
  trending: "趋势",
};

export default function AdminDemandsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async (status: StatusFilter) => {
    setLoading(true);
    const res = await fetch(`/api/admin/demands?status=${status}`);
    if (res.ok) {
      const data = await res.json();
      setItems(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data.items ?? []).map((item: any) => ({
          id: item.id,
          title: item.news_items?.title ?? "未知新闻",
          meta: `${SIGNAL_TYPE_LABELS[item.signal_type] ?? item.signal_type} · 评分 ${item.score}`,
          badge: item.status,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems(statusFilter);
  }, [statusFilter]);

  const moderate = async (ids: string[], action: "approve" | "reject") => {
    await fetch("/api/admin/demands/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action }),
    });
    fetchItems(statusFilter);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">需求信号审核</h1>

      <div className="flex gap-1 border-b">
        {(Object.keys(TAB_LABELS) as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-sm transition-colors ${
              statusFilter === s
                ? "border-b-2 border-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {TAB_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : (
        <ModerationTable
          items={items}
          onApprove={(ids) => moderate(ids, "approve")}
          onReject={(ids) => moderate(ids, "reject")}
        />
      )}
    </div>
  );
}
