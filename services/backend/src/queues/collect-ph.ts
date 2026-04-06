import { Queue, Worker } from "bullmq";
import type { AppConfig } from "../config.js";
import { getSupabase } from "../lib/supabase.js";
import { getRedis } from "../lib/redis.js";
import { trackWorker } from "./registry.js";

interface PHPost {
  id: string;
  name: string;
  tagline: string;
  url: string;
  website: string | null;
  votesCount: number;
  createdAt: string;
  topics: { edges: Array<{ node: { name: string } }> };
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

export function parsePHPosts(posts: PHPost[], sourceId: string): NewsItemInsert[] {
  return posts.map((post) => ({
    source_id: sourceId,
    title: post.name,
    url: post.website ?? post.url,
    summary: post.tagline,
    content: null,
    ai_tags: [],
    ai_summary: null,
    engagement_score: post.votesCount,
    published_at: post.createdAt,
  }));
}

const PH_GRAPHQL_URL = "https://api.producthunt.com/v2/api/graphql";

const PH_QUERY = `
  query {
    posts(order: VOTES, first: 20) {
      edges {
        node {
          id
          name
          tagline
          url
          website
          votesCount
          createdAt
          topics(first: 3) {
            edges { node { name } }
          }
        }
      }
    }
  }
`;

async function fetchPHPosts(): Promise<PHPost[]> {
  const phToken = process.env.PH_API_TOKEN;
  if (!phToken) {
    console.warn("PH_API_TOKEN not set, skipping Product Hunt collection");
    return [];
  }

  const res = await fetch(PH_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${phToken}`,
    },
    body: JSON.stringify({ query: PH_QUERY }),
  });

  if (!res.ok) throw new Error(`PH API error: ${res.status}`);
  const data = await res.json();
  return data.data.posts.edges.map((e: { node: PHPost }) => e.node);
}

export function setupPHCollector(config: AppConfig): { queue: Queue; worker: Worker } {
  const connection = getRedis(config.redisUrl);

  const queue = new Queue("collect-producthunt", { connection });

  const worker = new Worker(
    "collect-producthunt",
    async () => {
      const supabase = getSupabase(config.supabaseUrl, config.supabaseServiceRoleKey);

      const { data: source } = await supabase
        .from("sources")
        .select("id")
        .eq("type", "ph")
        .eq("is_active", true)
        .single();

      if (!source) {
        console.warn("No active PH source configured");
        return { collected: 0 };
      }

      const posts = await fetchPHPosts();
      if (posts.length === 0) return { collected: 0 };

      const items = parsePHPosts(posts, source.id);

      const { data, error } = await supabase
        .from("news_items")
        .upsert(items, { onConflict: "url", ignoreDuplicates: true })
        .select("id");

      if (error) throw error;
      const inserted = data?.length ?? 0;
      console.log(`PH: collected ${posts.length} posts, ${inserted} new`);
      return { collected: posts.length, inserted };
    },
    { connection }
  );

  queue.upsertJobScheduler("ph-repeat", {
    every: 24 * 60 * 60 * 1000,
  }, {
    name: "collect-ph",
  });

  trackWorker(worker);
  return { queue, worker };
}
