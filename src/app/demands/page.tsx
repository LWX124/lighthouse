import { createClient } from "@/lib/supabase/server";
import { DemandsPageClient } from "./demands-page-client";

export const dynamic = "force-dynamic";

export default async function DemandsPage() {
  const supabase = await createClient();

  const [{ data: signals }, { data: newsItems }] = await Promise.all([
    supabase
      .from("demand_signals")
      .select("*")
      .eq("status", "active")
      .order("score", { ascending: false }),
    supabase.from("news_items").select("id, title"),
  ]);

  // Build news title map
  const newsTitleMap: Record<string, string> = {};
  for (const n of newsItems ?? []) {
    newsTitleMap[n.id] = n.title;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">需求 Hub</h1>
        <p className="mt-2 text-muted-foreground">
          AI 驱动的需求信号发现，捕捉高价值市场机会
        </p>
      </div>

      <DemandsPageClient
        signals={signals ?? []}
        newsTitleMap={newsTitleMap}
      />
    </div>
  );
}
