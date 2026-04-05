import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/types";

type Tool = Database["public"]["Tables"]["ai_tools"]["Row"];
type Ranking = Database["public"]["Tables"]["tool_rankings"]["Row"];

interface ToolCardProps {
  tool: Tool;
  ranking?: Ranking;
}

function formatVisits(visits: number): string {
  if (visits >= 100_000_000) return `${(visits / 100_000_000).toFixed(1)} 亿`;
  if (visits >= 10_000) return `${(visits / 10_000).toFixed(1)} 万`;
  return visits.toLocaleString();
}

export function ToolCard({ tool, ranking }: ToolCardProps) {
  return (
    <Link href={`/tools/${tool.slug}`}>
      <Card className="border-border bg-card p-5 transition-colors hover:border-primary/50">
        <div className="flex items-start gap-4">
          {/* Rank */}
          {ranking?.rank && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
              #{ranking.rank}
            </div>
          )}

          {/* Logo placeholder */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
            {tool.name.charAt(0)}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold leading-tight">{tool.name}</h3>
              {tool.verified && (
                <span className="text-xs text-primary" title="已认证">
                  ✓
                </span>
              )}
              <Badge variant="outline" className="text-xs">
                {tool.pricing_model}
              </Badge>
            </div>

            {tool.description && (
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {tool.description}
              </p>
            )}

            {/* Tags */}
            {tool.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tool.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Ranking stats */}
            {ranking && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>📊 {formatVisits(ranking.monthly_visits)}</span>
                <span
                  className={
                    ranking.growth_rate > 0
                      ? "text-green-500"
                      : ranking.growth_rate < 0
                        ? "text-red-500"
                        : ""
                  }
                >
                  {ranking.growth_rate > 0 ? "↑" : ranking.growth_rate < 0 ? "↓" : "→"}{" "}
                  {Math.abs(ranking.growth_rate)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
