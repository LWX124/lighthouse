import { Queue, Worker } from "bullmq";
import Parser from "rss-parser";
import type { AppConfig } from "../config.js";
import { getSupabase } from "../lib/supabase.js";
import { getRedis } from "../lib/redis.js";
import { trackWorker } from "./registry.js";

interface RSSItem {
  title?: string;
  link?: string;
  contentSnippet?: string;
  isoDate?: string;
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

export function parseRSSItems(items: RSSItem[], sourceId: string): NewsItemInsert[] {
  return items
    .filter((item) => item.title && item.link)
    .map((item) => ({
      source_id: sourceId,
      title: item.title!,
      url: item.link!,
      summary: item.contentSnippet?.slice(0, 500) ?? null,
      content: null,
      ai_tags: [],
      ai_summary: null,
      engagement_score: 0,
      published_at: item.isoDate ?? new Date().toISOString(),
    }));
}

export function setupRSSCollector(config: AppConfig): { queue: Queue; worker: Worker } {
  const connection = getRedis(config.redisUrl);
  const parser = new Parser();

  const queue = new Queue("collect:rss", { connection });

  const worker = new Worker(
    "collect:rss",
    async () => {
      const supabase = getSupabase(config.supabaseUrl, config.supabaseServiceRoleKey);

      const { data: sources } = await supabase
        .from("sources")
        .select("id, config")
        .eq("type", "rss")
        .eq("is_active", true);

      if (!sources || sources.length === 0) {
        console.warn("No active RSS sources configured");
        return { collected: 0 };
      }

      let totalCollected = 0;
      let totalInserted = 0;

      for (const source of sources) {
        const feedUrl = (source.config as { url?: string })?.url;
        if (!feedUrl) {
          console.warn(`RSS source ${source.id} has no URL in config`);
          continue;
        }

        try {
          const feed = await parser.parseURL(feedUrl);
          const items = parseRSSItems(feed.items as RSSItem[], source.id);

          if (items.length === 0) continue;

          const { data, error } = await supabase
            .from("news_items")
            .upsert(items, { onConflict: "url", ignoreDuplicates: true })
            .select("id");

          if (error) {
            console.error(`RSS source ${source.id} upsert error:`, error);
            continue;
          }

          const inserted = data?.length ?? 0;
          totalCollected += items.length;
          totalInserted += inserted;
        } catch (err) {
          console.error(`RSS feed ${feedUrl} parse error:`, err);
        }
      }

      console.log(`RSS: collected ${totalCollected} items, ${totalInserted} new`);
      return { collected: totalCollected, inserted: totalInserted };
    },
    { connection }
  );

  queue.upsertJobScheduler("rss-repeat", {
    every: 60 * 60 * 1000,
  }, {
    name: "collect-rss",
  });

  trackWorker(worker);
  return { queue, worker };
}
