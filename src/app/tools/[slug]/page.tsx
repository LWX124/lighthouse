import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookmarkButton } from "@/components/tools/bookmark-button";

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

function formatVisits(visits: number): string {
  if (visits >= 100_000_000) return `${(visits / 100_000_000).toFixed(1)} 亿`;
  if (visits >= 10_000) return `${(visits / 10_000).toFixed(1)} 万`;
  return visits.toLocaleString();
}

export default async function ToolDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: tool } = await supabase
    .from("ai_tools")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!tool) notFound();

  // Fetch category name, rankings, and auth state
  const [categoryResult, { data: rankings }, { data: { user } }] =
    await Promise.all([
      tool.category_id
        ? supabase
            .from("tool_categories")
            .select("name, slug")
            .eq("id", tool.category_id)
            .single()
        : Promise.resolve({ data: null }),
      supabase
        .from("tool_rankings")
        .select("*")
        .eq("tool_id", tool.id)
        .order("period", { ascending: false })
        .limit(6),
      supabase.auth.getUser(),
    ]);

  const category = categoryResult?.data ?? null;
  const latestRanking = rankings?.[0] ?? null;

  // Check if user has bookmarked
  let isBookmarked = false;
  if (user) {
    const { data: bookmark } = await supabase
      .from("tool_bookmarks")
      .select("id")
      .eq("user_id", user.id)
      .eq("tool_id", tool.id)
      .single();
    isBookmarked = !!bookmark;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6 text-sm text-muted-foreground">
        <Link href="/tools" className="hover:text-foreground">
          AI 工具榜
        </Link>
        {category && (
          <>
            {" / "}
            <span>{category.name}</span>
          </>
        )}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Logo placeholder */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl font-bold text-primary">
            {tool.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{tool.name}</h1>
              {tool.verified && (
                <span className="text-primary" title="已认证">
                  ✓
                </span>
              )}
            </div>
            {tool.description && (
              <p className="mt-1 text-muted-foreground">{tool.description}</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline">{tool.pricing_model}</Badge>
              {tool.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <BookmarkButton
            toolId={tool.id}
            initialBookmarked={isBookmarked}
            userId={user?.id ?? null}
          />
          <a href={tool.url} target="_blank" rel="noopener noreferrer">
            <Button>访问官网 →</Button>
          </a>
        </div>
      </div>

      {/* Stats cards */}
      {latestRanking && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card className="border-border bg-card p-4 text-center">
            <div className="text-sm text-muted-foreground">当前排名</div>
            <div className="mt-1 text-2xl font-bold">
              #{latestRanking.rank ?? "—"}
            </div>
          </Card>
          <Card className="border-border bg-card p-4 text-center">
            <div className="text-sm text-muted-foreground">月访问量</div>
            <div className="mt-1 text-2xl font-bold">
              {formatVisits(latestRanking.monthly_visits)}
            </div>
          </Card>
          <Card className="border-border bg-card p-4 text-center">
            <div className="text-sm text-muted-foreground">增长率</div>
            <div
              className={`mt-1 text-2xl font-bold ${
                latestRanking.growth_rate > 0
                  ? "text-green-500"
                  : latestRanking.growth_rate < 0
                    ? "text-red-500"
                    : ""
              }`}
            >
              {latestRanking.growth_rate > 0 ? "+" : ""}
              {latestRanking.growth_rate}%
            </div>
          </Card>
        </div>
      )}

      {/* Rankings history */}
      {rankings && rankings.length > 1 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">排名趋势</h2>
          <Card className="border-border bg-card p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4">期间</th>
                    <th className="pb-2 pr-4">排名</th>
                    <th className="pb-2 pr-4">月访问量</th>
                    <th className="pb-2">增长率</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-2 pr-4">{r.period}</td>
                      <td className="py-2 pr-4">#{r.rank ?? "—"}</td>
                      <td className="py-2 pr-4">
                        {formatVisits(r.monthly_visits)}
                      </td>
                      <td
                        className={`py-2 ${
                          r.growth_rate > 0
                            ? "text-green-500"
                            : r.growth_rate < 0
                              ? "text-red-500"
                              : ""
                        }`}
                      >
                        {r.growth_rate > 0 ? "+" : ""}
                        {r.growth_rate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
