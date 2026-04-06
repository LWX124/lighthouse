# AI 实践模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AI Practice module — a chat-style interface where users input ideas/requirements and receive AI-generated business plans with market analysis, technical recommendations, and action items, powered by Claude streaming.

**Architecture:** The chat UI lives at `/practice`. AI streaming goes through a Next.js API Route (`/api/practice/chat`) that directly calls `@anthropic-ai/sdk` with streaming. Practice plans and message history are stored in Supabase (`practice_plans` + `plan_messages`). Freemium limits are enforced via the existing `user_usage` table. The Agent SDK integration is deferred to Phase 2.

**Tech Stack:** Next.js API Routes (streaming), @anthropic-ai/sdk (Messages API), Supabase (storage), shadcn/ui (chat UI)

---

## File Structure

```
supabase/migrations/005_practice.sql
src/lib/supabase/types.ts              (modify — add 2 tables)
src/app/api/practice/chat/route.ts     (new — streaming AI endpoint)
src/app/api/practice/plans/route.ts    (new — CRUD for plans)
src/app/practice/page.tsx              (new — SSR page)
src/app/practice/practice-page-client.tsx (new — chat UI)
src/components/practice/chat-message.tsx (new — message bubble)
src/components/practice/chat-input.tsx   (new — input area)
tests/components/practice/chat-message.test.tsx
tests/components/practice/chat-input.test.tsx
```

---

### Task 1: 数据库迁移 — practice_plans + plan_messages

**Files:**
- Create: `supabase/migrations/005_practice.sql`

- [ ] **Step 1: 创建迁移文件**

Create `supabase/migrations/005_practice.sql`:

```sql
-- Practice Plans
create table practice_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null default '新方案',
  input_prompt text,
  status text not null default 'pending' check (status in ('pending', 'generating', 'done')),
  result jsonb,
  model_used text not null default 'sonnet',
  is_public boolean not null default false,
  download_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Plan Messages (chat history)
create table plan_messages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references practice_plans(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_practice_plans_user on practice_plans(user_id, created_at desc);
create index idx_plan_messages_plan on plan_messages(plan_id, created_at);

-- RLS
alter table practice_plans enable row level security;
alter table plan_messages enable row level security;

create policy "Users can manage own plans"
  on practice_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read own plan messages"
  on plan_messages for select
  using (
    exists (
      select 1 from practice_plans
      where practice_plans.id = plan_messages.plan_id
      and practice_plans.user_id = auth.uid()
    )
  );

create policy "Users can insert own plan messages"
  on plan_messages for insert
  with check (
    exists (
      select 1 from practice_plans
      where practice_plans.id = plan_messages.plan_id
      and practice_plans.user_id = auth.uid()
    )
  );

-- Public plans are readable by all
create policy "Public plans are readable"
  on practice_plans for select
  using (is_public = true);
```

- [ ] **Step 2: 提交**

```bash
git add supabase/migrations/005_practice.sql
git commit -m "feat: add practice_plans and plan_messages database migration"
```

---

### Task 2: 更新 Database 类型

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: 在 Database types 中追加 practice_plans 和 plan_messages**

在 `demand_signals` 表定义之后、`Views` 之前追加：

```typescript
      practice_plans: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          input_prompt: string | null;
          status: "pending" | "generating" | "done";
          result: Record<string, unknown> | null;
          model_used: string;
          is_public: boolean;
          download_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["practice_plans"]["Row"],
          "id" | "created_at" | "updated_at" | "download_count"
        >;
        Update: Partial<
          Database["public"]["Tables"]["practice_plans"]["Insert"]
        >;
        Relationships: [];
      };
      plan_messages: {
        Row: {
          id: string;
          plan_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["plan_messages"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["plan_messages"]["Insert"]
        >;
        Relationships: [];
      };
```

- [ ] **Step 2: 验证构建**

Run: `npx next build`
Expected: 构建成功

- [ ] **Step 3: 提交**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat: add practice_plans and plan_messages types to Database definition"
```

---

### Task 3: 聊天消息组件 + 测试

**Files:**
- Create: `src/components/practice/chat-message.tsx`
- Create: `tests/components/practice/chat-message.test.tsx`

- [ ] **Step 1: 编写测试**

Create `tests/components/practice/chat-message.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ChatMessage } from "@/components/practice/chat-message";

describe("ChatMessage", () => {
  it("renders user message content", () => {
    render(<ChatMessage role="user" content="我想做一个 AI 写作助手" />);
    expect(screen.getByText("我想做一个 AI 写作助手")).toBeInTheDocument();
  });

  it("renders assistant message content", () => {
    render(<ChatMessage role="assistant" content="好的，让我帮你分析这个方向。" />);
    expect(screen.getByText("好的，让我帮你分析这个方向。")).toBeInTheDocument();
  });

  it("shows user label for user messages", () => {
    render(<ChatMessage role="user" content="test" />);
    expect(screen.getByText("你")).toBeInTheDocument();
  });

  it("shows AI label for assistant messages", () => {
    render(<ChatMessage role="assistant" content="test" />);
    expect(screen.getByText("AI")).toBeInTheDocument();
  });

  it("applies different alignment for user vs assistant", () => {
    const { container: userContainer } = render(
      <ChatMessage role="user" content="user msg" />
    );
    const userWrapper = userContainer.firstChild as HTMLElement;
    expect(userWrapper.className).toContain("justify-end");

    const { container: aiContainer } = render(
      <ChatMessage role="assistant" content="ai msg" />
    );
    const aiWrapper = aiContainer.firstChild as HTMLElement;
    expect(aiWrapper.className).toContain("justify-start");
  });
});
```

- [ ] **Step 2: 实现聊天消息组件**

Create `src/components/practice/chat-message.tsx`:

```tsx
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          AI
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <p className="whitespace-pre-wrap">{content}</p>
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
          你
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 运行测试**

Run: `npx vitest run tests/components/practice/chat-message.test.tsx`
Expected: 5 tests PASS

- [ ] **Step 4: 提交**

```bash
git add src/components/practice/chat-message.tsx tests/components/practice/chat-message.test.tsx
git commit -m "feat: add chat message bubble component with user/AI styling"
```

---

### Task 4: 聊天输入组件 + 测试

**Files:**
- Create: `src/components/practice/chat-input.tsx`
- Create: `tests/components/practice/chat-input.test.tsx`

- [ ] **Step 1: 编写测试**

Create `tests/components/practice/chat-input.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ChatInput } from "@/components/practice/chat-input";

describe("ChatInput", () => {
  it("renders textarea and send button", () => {
    render(<ChatInput onSend={() => {}} disabled={false} />);
    expect(screen.getByPlaceholderText(/描述你的想法/)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("calls onSend with input text when button is clicked", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);
    const textarea = screen.getByPlaceholderText(/描述你的想法/);
    fireEvent.change(textarea, { target: { value: "我想做一个 AI 工具" } });
    fireEvent.click(screen.getByRole("button"));
    expect(onSend).toHaveBeenCalledWith("我想做一个 AI 工具");
  });

  it("clears input after sending", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);
    const textarea = screen.getByPlaceholderText(/描述你的想法/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "test" } });
    fireEvent.click(screen.getByRole("button"));
    expect(textarea.value).toBe("");
  });

  it("does not send empty messages", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables button when disabled prop is true", () => {
    render(<ChatInput onSend={() => {}} disabled={true} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

- [ ] **Step 2: 实现聊天输入组件**

Create `src/components/practice/chat-input.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="描述你的想法或需求，AI 将帮你生成方案..."
        disabled={disabled}
        rows={2}
        className="flex-1 resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
      />
      <Button onClick={handleSend} disabled={disabled || !input.trim()} className="self-end">
        发送
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: 运行测试**

Run: `npx vitest run tests/components/practice/chat-input.test.tsx`
Expected: 5 tests PASS

- [ ] **Step 4: 提交**

```bash
git add src/components/practice/chat-input.tsx tests/components/practice/chat-input.test.tsx
git commit -m "feat: add chat input component with send on Enter and validation"
```

---

### Task 5: AI 聊天 API Route (Streaming)

**Files:**
- Create: `src/app/api/practice/chat/route.ts`

- [ ] **Step 1: 创建 streaming API 端点**

Create `src/app/api/practice/chat/route.ts`:

```typescript
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { planId, message } = await request.json();

  if (!planId || !message) {
    return new Response(JSON.stringify({ error: "Missing planId or message" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
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
      return new Response(JSON.stringify({ error: "Daily limit reached. Upgrade to Pro for unlimited." }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
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

  const model = isPro && plan.model_used === "opus"
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
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const text = event.delta.text;
            fullResponse += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }

        // Save full AI response
        await supabase.from("plan_messages").insert({
          plan_id: planId,
          role: "assistant",
          content: fullResponse,
        });

        // Update plan status and usage
        await supabase
          .from("practice_plans")
          .update({ status: "done" })
          .eq("id", planId);

        // Increment usage counter
        const today = new Date().toISOString().split("T")[0];
        await supabase.rpc("increment_usage", {
          p_user_id: user.id,
          p_date: today,
          p_field: "plan_generations",
        }).catch(() => {
          // Fallback: upsert directly
          supabase.from("user_usage").upsert(
            { user_id: user.id, date: today, plan_generations: 1, ai_requests: 0, tool_searches: 0 },
            { onConflict: "user_id,date" }
          );
        });

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "AI processing failed" })}\n\n`)
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
```

- [ ] **Step 2: 提交**

```bash
git add src/app/api/practice/chat/route.ts
git commit -m "feat: add streaming AI chat API route with usage limits"
```

---

### Task 6: Practice Plans API Route

**Files:**
- Create: `src/app/api/practice/plans/route.ts`

- [ ] **Step 1: 创建方案 CRUD 端点**

Create `src/app/api/practice/plans/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

// Create a new plan
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const title = body.title || "新方案";

  const { data: plan, error } = await supabase
    .from("practice_plans")
    .insert({
      user_id: user.id,
      title,
      status: "pending",
      model_used: "sonnet",
    })
    .select("id, title, status, created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(plan);
}

// List user's plans
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: plans } = await supabase
    .from("practice_plans")
    .select("id, title, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return Response.json(plans ?? []);
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/api/practice/plans/route.ts
git commit -m "feat: add practice plans CRUD API route"
```

---

### Task 7: AI 实践页面 (SSR + Client)

**Files:**
- Create: `src/app/practice/page.tsx`
- Create: `src/app/practice/practice-page-client.tsx`

- [ ] **Step 1: 创建服务端页面**

Create `src/app/practice/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { PracticePageClient } from "./practice-page-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PracticePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: plans } = await supabase
    .from("practice_plans")
    .select("id, title, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Check subscription
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">AI 实践</h1>
        <p className="mt-2 text-muted-foreground">
          描述你的想法，AI 帮你生成完整的落地方案
        </p>
      </div>

      <PracticePageClient
        plans={plans ?? []}
        isPro={subscription?.plan === "pro"}
      />
    </div>
  );
}
```

- [ ] **Step 2: 创建客户端交互组件**

Create `src/app/practice/practice-page-client.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatMessage } from "@/components/practice/chat-message";
import { ChatInput } from "@/components/practice/chat-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Plan {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PracticePageClientProps {
  plans: Plan[];
  isPro: boolean;
}

export function PracticePageClient({ plans: initialPlans, isPro }: PracticePageClientProps) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const createNewPlan = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/practice/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新方案" }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "创建方案失败");
      return;
    }

    const plan = await res.json();
    setPlans((prev) => [plan, ...prev]);
    setActivePlanId(plan.id);
    setMessages([]);
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (!activePlanId || isStreaming) return;

    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsStreaming(true);

    // Add placeholder for AI response
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/practice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: activePlanId, message: text }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "请求失败");
        setMessages((prev) => prev.slice(0, -1)); // Remove placeholder
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setError("无法读取响应流");
        setIsStreaming(false);
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);

          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + parsed.text,
                  };
                }
                return updated;
              });
            }
            if (parsed.error) {
              setError(parsed.error);
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }
    } catch (err) {
      setError("网络错误，请重试");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  }, [activePlanId, isStreaming]);

  return (
    <div className="flex gap-6">
      {/* Sidebar — plan list */}
      <div className="w-64 shrink-0 space-y-3">
        <Button onClick={createNewPlan} className="w-full">
          + 新方案
        </Button>

        <div className="space-y-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => {
                setActivePlanId(plan.id);
                setMessages([]);
              }}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                activePlanId === plan.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="font-medium truncate">{plan.title}</div>
              <div className="text-xs opacity-70">
                {new Date(plan.created_at).toLocaleDateString("zh-CN")}
              </div>
            </button>
          ))}
        </div>

        {!isPro && (
          <Card className="p-3 text-xs text-muted-foreground">
            免费版每日 1 次方案生成
          </Card>
        )}
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {activePlanId ? (
          <>
            <div
              ref={scrollRef}
              className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-border bg-background p-4"
              style={{ minHeight: "400px", maxHeight: "60vh" }}
            >
              {messages.length === 0 && (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <p>输入你的想法，AI 将帮你生成落地方案 ✨</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <ChatMessage key={i} role={msg.role} content={msg.content} />
              ))}
            </div>

            {error && (
              <p className="mt-2 text-sm text-red-500">{error}</p>
            )}

            <div className="mt-4">
              <ChatInput onSend={handleSend} disabled={isStreaming} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">选择一个方案或创建新方案</p>
              <p className="mt-1 text-sm">点击左侧「+ 新方案」开始</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add src/app/practice/
git commit -m "feat: add AI practice page with chat UI and streaming"
```

---

### Task 8: 端到端验证

**Files:**
- No new files

- [ ] **Step 1: 运行所有前端测试**

```bash
npx vitest run
```

Expected: 所有测试通过（含新增 chat-message, chat-input 测试）

- [ ] **Step 2: 运行后端测试**

```bash
cd services/backend && npx vitest run
```

Expected: 所有 29 后端测试仍然通过

- [ ] **Step 3: 构建检查**

```bash
npx next build
```

Expected: 构建成功，新增路由 `/practice` + `/api/practice/chat` + `/api/practice/plans`

- [ ] **Step 4: 验证路由输出**

构建输出中应包含：

```
Route (app)
├ ○ /
├ ƒ /demands
├ ƒ /news
├ ƒ /practice         ← 新增
├ ƒ /tools
├ ƒ /tools/[slug]
├ ƒ /tutorials
├ ƒ /tutorials/[category]
└ ƒ /tutorials/[category]/[slug]
```

- [ ] **Step 5: 提交修复（如有）**

```bash
git add -A
git commit -m "fix: resolve build issues for practice module"
```
