import { Queue, Worker } from "bullmq";
import type { AppConfig } from "../config.js";
import { getSupabase } from "../lib/supabase.js";
import { getRedis } from "../lib/redis.js";
import { getAnthropic } from "../lib/anthropic.js";
import { trackWorker } from "./registry.js";

const VALID_SIGNAL_TYPES = ["pain_point", "solution_req", "trending"] as const;
type SignalType = (typeof VALID_SIGNAL_TYPES)[number];

const VALID_COMPETITION_LEVELS = ["low", "medium", "high"] as const;

interface DemandSignalResult {
  signal_type: SignalType;
  score: number;
  market_size_est: string | null;
  competition_lvl: "low" | "medium" | "high" | null;
  ai_analysis: string;
}

export function buildDemandPrompt(title: string, summary: string | null): string {
  return `你是一个市场需求分析专家。请分析以下新闻是否包含值得关注的市场需求信号。

标题: ${title}
摘要: ${summary ?? "无摘要"}

请判断这条新闻是否包含以下类型的需求信号:
- pain_point: 用户/开发者明确表达的痛点
- solution_req: 对特定解决方案的需求
- trending: 正在增长的趋势，暗示未来需求

请以 JSON 格式返回:
{
  "has_signal": true/false,
  "signal_type": "pain_point" | "solution_req" | "trending",
  "score": 0-100,
  "market_size_est": "小型 ($1M-$10M)" | "中型 ($10M-$100M)" | "大型 ($100M+)" | null,
  "competition_lvl": "low" | "medium" | "high" | null,
  "ai_analysis": "中文分析说明，50-100 字"
}

评分标准:
- 80-100: 强烈需求信号，有明确付费意愿或大量用户讨论
- 50-79: 中等信号，有潜在机会但需验证
- 0-49: 弱信号，仅作参考

只返回 JSON，不要其他内容。`;
}

export function parseDemandResponse(text: string): DemandSignalResult | null {
  try {
    const data = JSON.parse(text);

    if (!data.has_signal) return null;

    if (!VALID_SIGNAL_TYPES.includes(data.signal_type)) return null;

    const score = Math.max(0, Math.min(100, Number(data.score) || 0));

    const competitionLvl = VALID_COMPETITION_LEVELS.includes(data.competition_lvl)
      ? data.competition_lvl
      : null;

    return {
      signal_type: data.signal_type,
      score,
      market_size_est: typeof data.market_size_est === "string" ? data.market_size_est : null,
      competition_lvl: competitionLvl,
      ai_analysis: typeof data.ai_analysis === "string" ? data.ai_analysis : "",
    };
  } catch {
    return null;
  }
}

export function setupDemandAnalysis(config: AppConfig): { queue: Queue; worker: Worker } {
  const connection = getRedis(config.redisUrl);

  const queue = new Queue("ai:demand-analysis", { connection });

  const worker = new Worker(
    "ai:demand-analysis",
    async () => {
      const supabase = getSupabase(config.supabaseUrl, config.supabaseServiceRoleKey);
      const anthropic = getAnthropic(config.anthropicApiKey);

      // Find news items with AI tags but no demand analysis yet
      const { data: items } = await supabase
        .from("news_items")
        .select("id, title, summary")
        .not("ai_tags", "eq", "{}")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!items || items.length === 0) {
        console.log("Demand Analysis: no items to process");
        return { processed: 0, signals: 0 };
      }

      // Check which items already have demand signals
      const { data: existing } = await supabase
        .from("demand_signals")
        .select("news_item_id")
        .in("news_item_id", items.map((i) => i.id));

      const existingIds = new Set((existing ?? []).map((e) => e.news_item_id));
      const unprocessed = items.filter((i) => !existingIds.has(i.id));

      if (unprocessed.length === 0) {
        console.log("Demand Analysis: all items already processed");
        return { processed: 0, signals: 0 };
      }

      let processed = 0;
      let signals = 0;

      for (const item of unprocessed) {
        try {
          const prompt = buildDemandPrompt(item.title, item.summary);

          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 300,
            messages: [{ role: "user", content: prompt }],
          });

          const text =
            response.content[0].type === "text"
              ? response.content[0].text
              : "";

          const result = parseDemandResponse(text);
          processed++;

          if (result) {
            await supabase.from("demand_signals").insert({
              news_item_id: item.id,
              signal_type: result.signal_type,
              score: result.score,
              market_size_est: result.market_size_est,
              competition_lvl: result.competition_lvl,
              ai_analysis: result.ai_analysis,
              status: "active",
            });
            signals++;
          }
        } catch (err) {
          console.error(`Demand analysis error for item ${item.id}:`, err);
        }
      }

      console.log(`Demand Analysis: processed ${processed}, found ${signals} signals`);
      return { processed, signals };
    },
    { connection, concurrency: 1 }
  );

  queue.upsertJobScheduler("demand-analysis-repeat", {
    every: 60 * 60 * 1000,
  }, {
    name: "ai-demand-analysis",
  });

  trackWorker(worker);
  return { queue, worker };
}
