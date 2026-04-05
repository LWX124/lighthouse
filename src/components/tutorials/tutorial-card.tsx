import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/types";

type Tutorial = Database["public"]["Tables"]["tutorials"]["Row"];

interface TutorialCardProps {
  tutorial: Tutorial;
  categorySlug: string;
}

export function TutorialCard({ tutorial, categorySlug }: TutorialCardProps) {
  return (
    <Link href={`/tutorials/${categorySlug}/${tutorial.slug}`}>
      <Card className="border-border bg-card p-5 transition-colors hover:border-primary/50">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <h3 className="font-semibold leading-tight">{tutorial.title}</h3>
            {tutorial.summary && (
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {tutorial.summary}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>🕐 {tutorial.read_time_minutes} 分钟</span>
              <span>👁 {tutorial.view_count.toLocaleString()} 浏览</span>
            </div>
          </div>
          {tutorial.is_free && (
            <Badge variant="secondary" className="shrink-0">
              免费
            </Badge>
          )}
        </div>
      </Card>
    </Link>
  );
}
