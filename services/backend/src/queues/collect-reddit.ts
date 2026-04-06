import { Queue, Worker } from "bullmq";
import type { AppConfig } from "../config.js";
import { getSupabase } from "../lib/supabase.js";
import { getRedis } from "../lib/redis.js";
import { trackWorker } from "./registry.js";

interface RedditPost {
  id: string;
  title: string;
  url: string;
  selftext: string;
  score: number;
  created_utc: number;
  subreddit: string;
  permalink: string;
  is_self: boolean;
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

const AI_SUBREDDITS = [
  "MachineLearning",
  "artificial",
  "LocalLLaMA",
  "singularity",
  "ChatGPT",
];

export function parseRedditPosts(posts: RedditPost[], sourceId: string): NewsItemInsert[] {
  return posts.map((post) => ({
    source_id: sourceId,
    title: post.title,
    url: post.is_self
      ? `https://www.reddit.com${post.permalink}`
      : post.url,
    summary: post.is_self && post.selftext ? post.selftext.slice(0, 500) : null,
    content: null,
    ai_tags: [],
    ai_summary: null,
    engagement_score: post.score,
    published_at: new Date(post.created_utc * 1000).toISOString(),
  }));
}

async function fetchRedditPosts(): Promise<RedditPost[]> {
  const allPosts: RedditPost[] = [];

  for (const sub of AI_SUBREDDITS) {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/hot.json?limit=10`,
        {
          headers: {
            "User-Agent": "lighthouse-backend/0.1 (data collection bot)",
          },
        }
      );

      if (!res.ok) {
        console.warn(`Reddit r/${sub} fetch failed: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const posts = data.data.children
        .map((c: { data: RedditPost }) => c.data)
        .filter((p: RedditPost) => p.score > 10);

      allPosts.push(...posts);
    } catch (err) {
      console.warn(`Reddit r/${sub} error:`, err);
    }
  }

  return allPosts;
}

export function setupRedditCollector(config: AppConfig): { queue: Queue; worker: Worker } {
  const connection = getRedis(config.redisUrl);

  const queue = new Queue("collect:reddit", { connection });

  const worker = new Worker(
    "collect:reddit",
    async () => {
      const supabase = getSupabase(config.supabaseUrl, config.supabaseServiceRoleKey);

      const { data: source } = await supabase
        .from("sources")
        .select("id")
        .eq("type", "reddit")
        .eq("is_active", true)
        .single();

      if (!source) {
        console.warn("No active Reddit source configured");
        return { collected: 0 };
      }

      const posts = await fetchRedditPosts();
      if (posts.length === 0) return { collected: 0 };

      const items = parseRedditPosts(posts, source.id);

      const { data, error } = await supabase
        .from("news_items")
        .upsert(items, { onConflict: "url", ignoreDuplicates: true })
        .select("id");

      if (error) throw error;
      const inserted = data?.length ?? 0;
      console.log(`Reddit: collected ${posts.length} posts, ${inserted} new`);
      return { collected: posts.length, inserted };
    },
    { connection }
  );

  queue.upsertJobScheduler("reddit-repeat", {
    every: 2 * 60 * 60 * 1000,
  }, {
    name: "collect-reddit",
  });

  trackWorker(worker);
  return { queue, worker };
}
