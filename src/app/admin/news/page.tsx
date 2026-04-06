"use client";

import { useEffect, useState } from "react";
import { ModerationTable, type ModerationItem } from "@/components/admin/moderation-table";

type StatusFilter = "pending" | "approved" | "rejected";

const TAB_LABELS: Record<StatusFilter, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
};

export default function AdminNewsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [moderateError, setModerateError] = useState<string | null>(null);

  const fetchItems = async (status: StatusFilter) => {
    setLoading(true);
    const res = await fetch(`/api/admin/news?status=${status}`);
    if (res.ok) {
      const data = await res.json();
      setItems(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data.items ?? []).map((item: any) => ({
          id: item.id,
          title: item.title,
          meta: `${item.source_name ?? "未知来源"} · ${new Date(item.published_at).toLocaleDateString("zh-CN")}`,
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
    setModerateError(null);
    const res = await fetch("/api/admin/news/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action }),
    });
    if (!res.ok) {
      const data = await res.json();
      setModerateError(data.error ?? "操作失败");
      return;
    }
    fetchItems(statusFilter);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">新闻审核</h1>

      {/* Tabs */}
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

      {moderateError && <p className="text-sm text-red-500">{moderateError}</p>}

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
