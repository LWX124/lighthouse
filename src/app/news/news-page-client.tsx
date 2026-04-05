"use client";

import { useState, useMemo } from "react";
import { NewsCard } from "@/components/news/news-card";
import { SourceFilter } from "@/components/news/source-filter";
import type { Database } from "@/lib/supabase/types";

type Source = Database["public"]["Tables"]["sources"]["Row"];
type NewsItem = Database["public"]["Tables"]["news_items"]["Row"];

interface NewsPageClientProps {
  sources: Source[];
  newsItems: NewsItem[];
}

export function NewsPageClient({
  sources,
  newsItems,
}: NewsPageClientProps) {
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  // Build source name map
  const sourceNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sources) {
      map.set(s.id, s.name);
    }
    return map;
  }, [sources]);

  // Filter by source
  const filteredItems = useMemo(() => {
    if (!activeSourceId) return newsItems;
    return newsItems.filter((item) => item.source_id === activeSourceId);
  }, [newsItems, activeSourceId]);

  return (
    <div className="space-y-6">
      <SourceFilter
        sources={sources}
        activeSourceId={activeSourceId}
        onSelect={setActiveSourceId}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((item) => (
          <NewsCard
            key={item.id}
            item={item}
            sourceName={sourceNameMap.get(item.source_id) ?? "未知来源"}
          />
        ))}
        {filteredItems.length === 0 && (
          <p className="col-span-full py-8 text-center text-muted-foreground">
            暂无新闻
          </p>
        )}
      </div>
    </div>
  );
}
