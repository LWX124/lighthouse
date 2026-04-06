"use client";

import { useEffect, useState } from "react";

interface Category {
  id: string;
  name: string;
  slug: string;
  tutorial_count: number;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/categories");
    if (res.ok) {
      const data = await res.json();
      setCategories(data.categories ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleCreate = async () => {
    if (!newName || !newSlug) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, slug: newSlug }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { setError(data.error); return; }
    setNewName("");
    setNewSlug("");
    fetchCategories();
  };

  const handleRename = async (id: string) => {
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, slug: editSlug }),
    });
    if (res.ok) {
      setEditingId(null);
      fetchCategories();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除该系列？")) return;
    const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    fetchCategories();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">系列管理</h1>

      {/* Create form */}
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => { setNewName(e.target.value); setNewSlug(slugify(e.target.value)); }}
          placeholder="系列名称"
          className="rounded border bg-background px-3 py-2 text-sm"
        />
        <input
          value={newSlug}
          onChange={(e) => setNewSlug(e.target.value)}
          placeholder="slug"
          className="rounded border bg-background px-3 py-2 text-sm font-mono"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newName || !newSlug}
          className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          新建系列
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : (
        <div className="rounded-lg border">
          <div className="divide-y">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
                {editingId === cat.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded border bg-background px-2 py-1 text-sm"
                    />
                    <input
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value)}
                      className="rounded border bg-background px-2 py-1 text-sm font-mono"
                    />
                    <button
                      onClick={() => handleRename(cat.id)}
                      className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded border px-3 py-1 text-xs"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{cat.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{cat.slug} · {cat.tutorial_count} 篇教程</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingId(cat.id);
                        setEditName(cat.name);
                        setEditSlug(cat.slug);
                      }}
                      className="rounded border px-2 py-1 text-xs hover:bg-accent"
                    >
                      重命名
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      disabled={cat.tutorial_count > 0}
                      className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                      title={cat.tutorial_count > 0 ? "该系列下有教程，无法删除" : undefined}
                    >
                      删除
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
