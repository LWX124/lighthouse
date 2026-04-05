import { createClient } from "@/lib/supabase/server";
import { NewsPageClient } from "./news-page-client";

export const revalidate = 3600;

export default async function NewsPage() {
  const supabase = await createClient();

  const [{ data: sources }, { data: newsItems }] = await Promise.all([
    supabase.from("sources").select("*").eq("is_active", true).order("name"),
    supabase
      .from("news_items")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">AI 新鲜事</h1>
        <p className="mt-2 text-muted-foreground">
          多源 AI 资讯聚合，发现行业最新动态
        </p>
      </div>

      <NewsPageClient
        sources={sources ?? []}
        newsItems={newsItems ?? []}
      />
    </div>
  );
}
