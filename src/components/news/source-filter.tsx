"use client";

import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type Source = Database["public"]["Tables"]["sources"]["Row"];

const sourceIcons: Record<string, string> = {
  hn: "🟠",
  ph: "🐱",
  reddit: "🔵",
  rss: "📡",
  x: "𝕏",
};

interface SourceFilterProps {
  sources: Source[];
  activeSourceId: string | null;
  onSelect: (sourceId: string | null) => void;
}

export function SourceFilter({
  sources,
  activeSourceId,
  onSelect,
}: SourceFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          activeSourceId === null
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        全部
      </button>
      {sources.map((source) => (
        <button
          key={source.id}
          onClick={() => onSelect(source.id)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            activeSourceId === source.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          {sourceIcons[source.type] ?? "📰"} {source.name}
        </button>
      ))}
    </div>
  );
}
