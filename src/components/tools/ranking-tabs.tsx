"use client";

import { cn } from "@/lib/utils";

export type RankingTab = "monthly" | "growth" | "new";

interface RankingTabsProps {
  activeTab: RankingTab;
  onTabChange: (tab: RankingTab) => void;
}

const tabs: { key: RankingTab; label: string; icon: string }[] = [
  { key: "monthly", label: "月度榜", icon: "🏆" },
  { key: "growth", label: "增长榜", icon: "📈" },
  { key: "new", label: "新工具", icon: "🆕" },
];

export function RankingTabs({ activeTab, onTabChange }: RankingTabsProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => {
            if (tab.key !== activeTab) onTabChange(tab.key);
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            activeTab === tab.key
              ? "border border-primary bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
