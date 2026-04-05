"use client";

import { useState, useMemo } from "react";
import { DemandCard } from "@/components/demands/demand-card";
import {
  DemandFilters,
  type SortBy,
} from "@/components/demands/demand-filters";
import type { Database } from "@/lib/supabase/types";

type DemandSignal = Database["public"]["Tables"]["demand_signals"]["Row"];
type SignalType = DemandSignal["signal_type"];

interface DemandsPageClientProps {
  signals: DemandSignal[];
  newsTitleMap: Record<string, string>;
}

export function DemandsPageClient({
  signals,
  newsTitleMap,
}: DemandsPageClientProps) {
  const [activeType, setActiveType] = useState<SignalType | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("score");

  const filteredSignals = useMemo(() => {
    let result = signals;

    // Type filter
    if (activeType) {
      result = result.filter((s) => s.signal_type === activeType);
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === "score") return b.score - a.score;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    return result;
  }, [signals, activeType, sortBy]);

  return (
    <div className="space-y-6">
      <DemandFilters
        activeType={activeType}
        sortBy={sortBy}
        onTypeChange={setActiveType}
        onSortChange={setSortBy}
      />

      <div className="space-y-4">
        {filteredSignals.map((signal) => (
          <DemandCard
            key={signal.id}
            signal={signal}
            newsTitle={
              newsTitleMap[signal.news_item_id] ?? "未知来源"
            }
          />
        ))}
        {filteredSignals.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            暂无需求信号
          </p>
        )}
      </div>
    </div>
  );
}
