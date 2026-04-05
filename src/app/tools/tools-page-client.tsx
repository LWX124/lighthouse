"use client";

import { useState, useMemo } from "react";
import { ToolCard } from "@/components/tools/tool-card";
import { ToolCategoryFilter } from "@/components/tools/tool-category-filter";
import { RankingTabs, type RankingTab } from "@/components/tools/ranking-tabs";
import type { Database } from "@/lib/supabase/types";

type Tool = Database["public"]["Tables"]["ai_tools"]["Row"];
type ToolCategory = Database["public"]["Tables"]["tool_categories"]["Row"];
type Ranking = Database["public"]["Tables"]["tool_rankings"]["Row"];

interface ToolsPageClientProps {
  categories: ToolCategory[];
  tools: Tool[];
  rankings: Ranking[];
}

export function ToolsPageClient({
  categories,
  tools,
  rankings,
}: ToolsPageClientProps) {
  const [activeTab, setActiveTab] = useState<RankingTab>("monthly");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Build tool-id to ranking map
  const rankingMap = useMemo(() => {
    const map = new Map<string, Ranking>();
    for (const r of rankings) {
      map.set(r.tool_id, r);
    }
    return map;
  }, [rankings]);

  // Filter and sort tools based on active tab + category
  const filteredTools = useMemo(() => {
    let result = tools;

    // Category filter
    if (activeCategory) {
      const cat = categories.find((c) => c.slug === activeCategory);
      if (cat) {
        result = result.filter((t) => t.category_id === cat.id);
      }
    }

    // Sort based on tab
    switch (activeTab) {
      case "monthly":
        result = [...result].sort((a, b) => {
          const ra = rankingMap.get(a.id)?.rank ?? 9999;
          const rb = rankingMap.get(b.id)?.rank ?? 9999;
          return ra - rb;
        });
        break;
      case "growth":
        result = [...result].sort((a, b) => {
          const ga = rankingMap.get(a.id)?.growth_rate ?? 0;
          const gb = rankingMap.get(b.id)?.growth_rate ?? 0;
          return gb - ga;
        });
        break;
      case "new":
        result = [...result].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
    }

    return result;
  }, [tools, rankings, activeTab, activeCategory, categories, rankingMap]);

  return (
    <div className="flex gap-8">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <ToolCategoryFilter
          categories={categories}
          activeSlug={activeCategory}
          onSelect={setActiveCategory}
        />
      </aside>

      {/* Main content */}
      <div className="flex-1">
        <div className="mb-6">
          <RankingTabs activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        <div className="space-y-3">
          {filteredTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              ranking={rankingMap.get(tool.id)}
            />
          ))}
          {filteredTools.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              暂无符合条件的工具
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
