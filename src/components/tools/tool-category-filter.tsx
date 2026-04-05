"use client";

import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type ToolCategory = Database["public"]["Tables"]["tool_categories"]["Row"];

interface ToolCategoryFilterProps {
  categories: ToolCategory[];
  activeSlug: string | null;
  onSelect: (slug: string | null) => void;
}

export function ToolCategoryFilter({
  categories,
  activeSlug,
  onSelect,
}: ToolCategoryFilterProps) {
  return (
    <div className="space-y-1">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        工具分类
      </h3>
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
          activeSlug === null
            ? "bg-muted font-medium text-primary"
            : "text-muted-foreground"
        )}
      >
        全部
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.slug)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
            activeSlug === cat.slug
              ? "bg-muted font-medium text-primary"
              : "text-muted-foreground"
          )}
        >
          {cat.icon && <span>{cat.icon}</span>}
          <span>{cat.name}</span>
        </button>
      ))}
    </div>
  );
}
