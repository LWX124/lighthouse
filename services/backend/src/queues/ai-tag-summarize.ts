import { Queue, Worker } from "bullmq";
import type { AppConfig } from "../config.js";
import { getSupabase } from "../lib/supabase.js";
import { getRedis } from "../lib/redis.js";
import { getAnthropic } from "../lib/anthropic.js";
import { trackWorker } from "./registry.js";

export function buildTagPrompt(title: string, summary: string | null): string {
  return `你是一个 AI 新闻分析助手。请为以下新闻生成标签和中文摘要。

标题: ${title}
摘要: ${summary ?? "无摘要"}

请以 JSON 格式返回:
{
  "tags": ["标签1", "标签2", ...],  // 3-5 个英文小写标签
  "summary": "一句话中文摘要"
}

只返回 JSON，不要其他内容。`;
}

export function parseTagResponse(text: string): { tags: string[]; summary: string | null } {
  try {
    const data = JSON.parse(text);
    const tags = Array.isArray(data.tags)
      ? data.tags.slice(0, 5).map((t: unknown) => String(t).toLowerCase())
      : [];
    const summary = typeof data.summary === "string" ? data.summary : null;
    return { tags, summary };
  } catch {
    return { tags: [], summary: null };
  }
}

export function setupAITagSummarize(config: AppConfig): { queue: Queue; worker: Worker } {
  const connection = getRedis(config.redisUrl);

  const queue = new Queue("ai-tag-and-summarize", { connection });

  const worker = new Worker(
    "ai-tag-and-summarize",
    async () => {
      const supabase = getSupabase(config.supabaseUrl, config.supabaseServiceRoleKey);
      const anthropic = getAnthropic(config.anthropicApiKey);

      // Find news items without AI tags (empty array) and without AI summary
      const { data: items } = await supabase
        .from("news_items")
        .select("id, title, summary")
        .is("ai_summary", null)
        .eq("ai_tags", "{}")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!items || items.length === 0) {
        console.log("AI Tag: no unprocessed items");
        return { processed: 0 };
      }

      let processed = 0;

      for (const item of items) {
        try {
          const prompt = buildTagPrompt(item.title, item.summary);

          const response = await anthropic.messages.create({
            model: "claude-haiku-4-5-20250414",
            max_tokens: 200,
            messages: [{ role: "user", content: prompt }],
          });

          const text =
            response.content[0].type === "text"
              ? response.content[0].text
              : "";

          const parsed = parseTagResponse(text);

          await supabase
            .from("news_items")
            .update({
              ai_tags: parsed.tags,
              ai_summary: parsed.summary,
            })
            .eq("id", item.id);

          processed++;
        } catch (err) {
          console.error(`AI Tag error for item ${item.id}:`, err);
        }
      }

      console.log(`AI Tag: processed ${processed}/${items.length} items`);
      return { processed };
    },
    { connection, concurrency: 1 }
  );

  queue.upsertJobScheduler("ai-tag-repeat", {
    every: 30 * 60 * 1000,
  }, {
    name: "ai-tag-summarize",
  });

  trackWorker(worker);
  return { queue, worker };
}
