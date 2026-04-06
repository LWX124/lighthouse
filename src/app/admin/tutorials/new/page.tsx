"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TutorialEditor } from "@/components/admin/tutorial-editor";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .slice(0, 80);
}

export default function NewTutorialPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTitleChange = (v: string) => {
    setTitle(v);
    setSlug(slugify(v));
  };

  const save = async (status: "draft" | "published") => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/tutorials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        slug,
        content,
        is_free: isFree,
        status,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "保存失败");
      return;
    }
    router.push("/admin/tutorials");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">新建教程</h1>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">标题</label>
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
            placeholder="教程标题"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm font-mono"
            placeholder="tutorial-slug"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is-free"
            checked={isFree}
            onChange={(e) => setIsFree(e.target.checked)}
          />
          <label htmlFor="is-free" className="text-sm">免费教程</label>
        </div>

        <div>
          <label className="text-sm font-medium">内容</label>
          <div className="mt-1">
            <TutorialEditor value={content} onChange={setContent} />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => save("draft")}
          disabled={saving || !title || !slug}
          className="rounded border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          保存草稿
        </button>
        <button
          onClick={() => save("published")}
          disabled={saving || !title || !slug}
          className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          发布
        </button>
      </div>
    </div>
  );
}
