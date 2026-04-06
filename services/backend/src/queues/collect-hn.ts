import { Queue, Worker } from "bullmq";
import type { AppConfig } from "../config.js";
import { getSupabase } from "../lib/supabase.js";
import { getRedis } from "../lib/redis.js";
import { trackWorker } from "./registry.js";

interface HNHit {
  objectID: string;
  title: string;
  url: string | null;
  points: number;
  created_at_i: number;
  _tags: string[];
}

interface NewsItemInsert {
  source_id: string;
  title: string;
  url: string;
  summary: string | null;
  content: string | null;
  ai_tags: string[];
  ai_summary: string | null;
  engagement_score: number;
  published_at: string;
}

export function parseHNStories(hits: HNHit[], sourceId: string): NewsItemInsert[] {
  return hits.map((hit) => ({
    source_id: sourceId,
    title: hit.title,
    url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
    summary: null,
    content: null,
    ai_tags: [],
    ai_summary: null,
    engagement_score: hit.points,
    published_at: new Date(hit.created_at_i * 1000).toISOString(),
  }));
}

async function fetchHNFrontPage(): Promise<HNHit[]> {
  const url =
    "https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=30&numericFilters=points>20";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HN API error: ${res.status}`);
  const data = await res.json();
  return data.hits as HNHit[];
}

export function setupHNCollector(config: AppConfig): { queue: Queue; worker: Worker } {
  const connection = getRedis(config.redisUrl);

  const queue = new Queue("collect-hackernews", { connection });

  const worker = new Worker(
    "collect-hackernews",
    async () => {
      const supabase = getSupabase(config.supabaseUrl, config.supabaseServiceRoleKey);

      const { data: source } = await supabase
        .from("sources")
        .select("id")
        .eq("type", "hn")
        .eq("is_active", true)
        .single();

      if (!source) {
        console.warn("No active HN source configured");
        return { collected: 0 };
      }

      const hits = await fetchHNFrontPage();
      const items = parseHNStories(hits, source.id);

      const { data, error } = await supabase
        .from("news_items")
        .upsert(items, { onConflict: "url", ignoreDuplicates: true })
        .select("id");

      if (error) throw error;
      const inserted = data?.length ?? 0;
      console.log(`HN: collected ${hits.length} stories, ${inserted} new`);
      return { collected: hits.length, inserted };
    },
    { connection }
  );

  queue.upsertJobScheduler("hn-repeat", {
    every: 2 * 60 * 60 * 1000,
  }, {
    name: "collect-hn",
  });

  trackWorker(worker);
  return { queue, worker };
}
