import { createClient } from "@/lib/supabase/server";
import { ToolsPageClient } from "./tools-page-client";

export const revalidate = 3600;

export default async function ToolsPage() {
  const supabase = await createClient();

  const [
    { data: categories },
    { data: tools },
    { data: rankings },
  ] = await Promise.all([
    supabase.from("tool_categories").select("*").order("order"),
    supabase.from("ai_tools").select("*").eq("status", "published").order("name"),
    supabase.from("tool_rankings").select("*").order("rank"),
  ]);

  // Determine latest period from rankings
  const latestPeriod = rankings?.[0]?.period ?? null;
  const latestRankings = latestPeriod
    ? rankings!.filter((r) => r.period === latestPeriod)
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">AI 工具榜</h1>
        <p className="mt-2 text-muted-foreground">
          发现最佳 AI 工具，多维度排名助你选择
        </p>
      </div>

      <ToolsPageClient
        categories={categories ?? []}
        tools={tools ?? []}
        rankings={latestRankings}
      />
    </div>
  );
}
