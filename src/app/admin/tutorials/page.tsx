"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface TutorialRow {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  category_id: string | null;
  updated_at: string;
  categories: { name: string } | null;
}

export default function AdminTutorialsPage() {
  const [tutorials, setTutorials] = useState<TutorialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchTutorials = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/tutorials");
    if (res.ok) {
      const data = await res.json();
      setTutorials(data.tutorials ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTutorials(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除这篇教程？")) return;
    await fetch(`/api/admin/tutorials/${id}`, { method: "DELETE" });
    fetchTutorials();
  };

  const handleToggleStatus = async (id: string, current: "draft" | "published") => {
    const newStatus = current === "draft" ? "published" : "draft";
    await fetch(`/api/admin/tutorials/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchTutorials();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">教程管理</h1>
        <Link
          href="/admin/tutorials/new"
          className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          新建教程
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : tutorials.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无教程</p>
      ) : (
        <div className="rounded-lg border">
          <div className="divide-y">
            {tutorials.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.categories?.name ?? "无系列"} ·{" "}
                    {new Date(t.updated_at).toLocaleDateString("zh-CN")}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-xs ${
                    t.status === "published"
                      ? "bg-green-500/10 text-green-500"
                      : "bg-yellow-500/10 text-yellow-500"
                  }`}
                >
                  {t.status === "published" ? "已发布" : "草稿"}
                </span>
                <div className="flex gap-2 shrink-0 text-xs">
                  <button
                    onClick={() => router.push(`/admin/tutorials/${t.id}/edit`)}
                    className="rounded border px-2 py-1 hover:bg-accent"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleToggleStatus(t.id, t.status)}
                    className="rounded border px-2 py-1 hover:bg-accent"
                  >
                    {t.status === "draft" ? "发布" : "取消发布"}
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="rounded border border-red-500/30 px-2 py-1 text-red-500 hover:bg-red-500/10"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
