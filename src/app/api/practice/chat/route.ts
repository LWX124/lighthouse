import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const SYSTEM_PROMPT = `你是一个创业顾问和产品专家。用户会向你描述他们的产品想法或需求，你需要：

1. 先通过 1-2 个问题澄清需求（目标用户、核心功能、预算/时间）
2. 然后生成一个详细的方案，包括：
   - 📊 市场分析（目标市场、竞品、机会）
   - 🛠 技术方案（推荐技术栈、架构建议）
   - 📋 执行计划（分阶段里程碑）
   - 💰 资源清单（所需工具、预估成本）

回答使用中文，格式清晰，善用标题和列表。如果用户的想法已经足够清晰，可以直接生成方案而不需要额外澄清。`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { planId, message } = await request.json();

  if (!planId || !message) {
    return new Response(
      JSON.stringify({ error: "Missing planId or message" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Verify plan ownership
  const { data: plan } = await supabase
    .from("practice_plans")
    .select("id, status, model_used")
    .eq("id", planId)
    .eq("user_id", user.id)
    .single();

  if (!plan) {
    return new Response(JSON.stringify({ error: "Plan not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check daily usage limit for free users
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  const isPro = subscription?.plan === "pro";

  if (!isPro) {
    const today = new Date().toISOString().split("T")[0];
    const { data: usage } = await supabase
      .from("user_usage")
      .select("plan_generations")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    if (usage && usage.plan_generations >= 1) {
      return new Response(
        JSON.stringify({
          error: "今日免费额度已用完，升级 Pro 可无限使用",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Save user message
  await supabase.from("plan_messages").insert({
    plan_id: planId,
    role: "user",
    content: message,
  });

  // Load chat history
  const { data: history } = await supabase
    .from("plan_messages")
    .select("role, content")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });

  const messages = (history ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Stream response from Claude
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  const model =
    isPro && plan.model_used === "opus"
      ? "claude-opus-4-20250514"
      : "claude-sonnet-4-20250514";

  const stream = anthropic.messages.stream({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages,
  });

  // Update plan status
  await supabase
    .from("practice_plans")
    .update({ status: "generating" })
    .eq("id", planId);

  // Create readable stream for SSE
  const encoder = new TextEncoder();
  let fullResponse = "";

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const text = event.delta.text;
            fullResponse += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }

        // Save full AI response
        await supabase.from("plan_messages").insert({
          plan_id: planId,
          role: "assistant",
          content: fullResponse,
        });

        // Update plan status
        await supabase
          .from("practice_plans")
          .update({ status: "done" })
          .eq("id", planId);

        // Increment usage counter (ignore errors — non-critical)
        const today = new Date().toISOString().split("T")[0];
        await supabase
          .from("user_usage")
          .upsert(
            {
              user_id: user.id,
              date: today,
              plan_generations: 1,
              ai_requests: 0,
              tool_searches: 0,
            },
            { onConflict: "user_id,date" }
          );

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "AI 处理失败，请重试" })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
