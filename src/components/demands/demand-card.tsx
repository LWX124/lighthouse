import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/types";

type DemandSignal = Database["public"]["Tables"]["demand_signals"]["Row"];

interface DemandCardProps {
  signal: DemandSignal;
  newsTitle: string;
}

const signalTypeLabels: Record<DemandSignal["signal_type"], string> = {
  pain_point: "痛点需求",
  solution_req: "方案需求",
  trending: "趋势需求",
};

const signalTypeColors: Record<DemandSignal["signal_type"], string> = {
  pain_point: "bg-red-500/10 text-red-500",
  solution_req: "bg-blue-500/10 text-blue-500",
  trending: "bg-green-500/10 text-green-500",
};

const competitionLabels: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 50) return "text-yellow-500";
  return "text-muted-foreground";
}

export function DemandCard({ signal, newsTitle }: DemandCardProps) {
  return (
    <Card className="border-border bg-card p-5">
      <div className="flex items-start gap-4">
        {/* Score */}
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-lg font-bold ${scoreColor(signal.score)}`}
        >
          {signal.score}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${signalTypeColors[signal.signal_type]}`}
            >
              {signalTypeLabels[signal.signal_type]}
            </span>
            {signal.market_size_est && (
              <Badge variant="outline" className="text-xs">
                {signal.market_size_est}
              </Badge>
            )}
            {signal.competition_lvl && (
              <span className="text-xs text-muted-foreground">
                竞争: {competitionLabels[signal.competition_lvl] ?? signal.competition_lvl}
              </span>
            )}
          </div>

          {signal.ai_analysis && (
            <p className="text-sm leading-relaxed">
              {signal.ai_analysis}
            </p>
          )}

          <div className="text-xs text-muted-foreground">
            📰 来源: {newsTitle}
          </div>
        </div>
      </div>
    </Card>
  );
}
