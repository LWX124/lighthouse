"use client";

import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type SignalType = Database["public"]["Tables"]["demand_signals"]["Row"]["signal_type"];
export type SortBy = "score" | "date";

interface DemandFiltersProps {
  activeType: SignalType | null;
  sortBy: SortBy;
  onTypeChange: (type: SignalType | null) => void;
  onSortChange: (sort: SortBy) => void;
}

const typeOptions: { key: SignalType | null; label: string }[] = [
  { key: null, label: "全部" },
  { key: "pain_point", label: "痛点需求" },
  { key: "solution_req", label: "方案需求" },
  { key: "trending", label: "趋势需求" },
];

const sortOptions: { key: SortBy; label: string }[] = [
  { key: "score", label: "按评分" },
  { key: "date", label: "按时间" },
];

export function DemandFilters({
  activeType,
  sortBy,
  onTypeChange,
  onSortChange,
}: DemandFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        {typeOptions.map((opt) => (
          <button
            key={opt.key ?? "all"}
            onClick={() => onTypeChange(opt.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              activeType === opt.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {sortOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => {
              if (opt.key !== sortBy) onSortChange(opt.key);
            }}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              sortBy === opt.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
