import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/types";

type NewsItem = Database["public"]["Tables"]["news_items"]["Row"];

interface NewsCardProps {
  item: NewsItem;
  sourceName: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return `${Math.floor(days / 30)} 月前`;
}

export function NewsCard({ item, sourceName }: NewsCardProps) {
  const displaySummary = item.ai_summary ?? item.summary;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <Card className="border-border bg-card p-5 transition-colors hover:border-primary/50">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
              {sourceName}
            </span>
            <span>{timeAgo(item.published_at)}</span>
            <span>🔥 {item.engagement_score}</span>
          </div>

          <h3 className="font-semibold leading-tight">{item.title}</h3>

          {displaySummary && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {displaySummary}
            </p>
          )}

          {item.ai_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.ai_tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>
    </a>
  );
}
