# Plan 3: AI 新鲜事 + 需求 Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 AI 新鲜事（新闻聚合）和需求 Hub（需求信号发现）的数据库表、前端页面和组件。数据采集 Workers 和 AI 处理在后续 Backend Plan 中实现。

**Architecture:** 新增 3 张 Supabase 表（sources, news_items, demand_signals）。新鲜事使用 ISR (1h) + 客户端来源筛选；需求 Hub 使用 SSR + 客户端动态筛选/排序。两个模块共享 sources 表。

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Supabase (PostgreSQL + RLS), Vitest

**Spec Reference:** `docs/superpowers/specs/2026-04-05-lighthouse-design.md` §3.4, §4.3, §4.4

---

## File Structure

```
src/
├── lib/supabase/types.ts                          # 修改: 新增 sources, news_items, demand_signals 类型
├── app/news/
│   ├── page.tsx                                   # 新鲜事主页 (来源筛选 + 新闻卡片网格)
│   └── news-page-client.tsx                       # 客户端筛选交互
├── app/demands/
│   ├── page.tsx                                   # 需求 Hub 主页 (筛选 + 需求信号列表)
│   └── demands-page-client.tsx                    # 客户端筛选/排序交互
├── components/news/
│   ├── news-card.tsx                              # 新闻卡片组件
│   └── source-filter.tsx                          # 来源筛选 pills
├── components/demands/
│   ├── demand-card.tsx                            # 需求信号卡片
│   └── demand-filters.tsx                         # 需求筛选 (类型/评分)
tests/
├── components/news/
│   ├── news-card.test.tsx
│   └── source-filter.test.tsx
├── components/demands/
│   ├── demand-card.test.tsx
│   └── demand-filters.test.tsx
supabase/
└── migrations/
    └── 004_news_demands.sql                       # sources + news_items + demand_signals
```

---

## Task 1: 数据库迁移 — 新闻 + 需求表

**Files:**
- Create: `supabase/migrations/004_news_demands.sql`

- [ ] **Step 1: 创建迁移文件**

Create `supabase/migrations/004_news_demands.sql`:

```sql
-- Data sources configuration
create table public.sources (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null check (type in ('hn', 'ph', 'reddit', 'rss', 'x')),
  config jsonb default '{}',
  fetch_interval integer default 3600, -- seconds
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.sources enable row level security;

create policy "Sources are viewable by everyone"
  on public.sources for select using (true);

-- News items
create table public.news_items (
  id uuid default gen_random_uuid() primary key,
  source_id uuid references public.sources(id) on delete cascade not null,
  title text not null,
  url text not null unique,
  summary text,
  content text,
  ai_tags text[] default '{}',
  ai_summary text,
  engagement_score integer default 0,
  published_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.news_items enable row level security;

create policy "News items are viewable by everyone"
  on public.news_items for select using (true);

create index news_items_published_at_idx on public.news_items (published_at desc);
create index news_items_source_idx on public.news_items (source_id);
create index news_items_tags_idx on public.news_items using gin (ai_tags);

-- Demand signals (derived from news_items via AI analysis)
create table public.demand_signals (
  id uuid default gen_random_uuid() primary key,
  news_item_id uuid references public.news_items(id) on delete cascade not null,
  signal_type text not null check (signal_type in ('pain_point', 'solution_req', 'trending')),
  score integer default 0 check (score >= 0 and score <= 100),
  market_size_est text,
  competition_lvl text check (competition_lvl in ('low', 'medium', 'high')),
  ai_analysis text,
  status text default 'active' check (status in ('active', 'archived', 'dismissed')),
  created_at timestamptz default now()
);

alter table public.demand_signals enable row level security;

create policy "Active demand signals are viewable by everyone"
  on public.demand_signals for select using (status = 'active');

create index demand_signals_score_idx on public.demand_signals (score desc);
create index demand_signals_type_idx on public.demand_signals (signal_type);

-- Seed data: sources
insert into public.sources (name, type, config, fetch_interval, is_active) values
  ('HackerNews', 'hn', '{"api_url": "https://hn.algolia.com/api/v1"}', 7200, true),
  ('Product Hunt', 'ph', '{"api_url": "https://api.producthunt.com/v2/api/graphql"}', 86400, true),
  ('Reddit r/artificial', 'reddit', '{"subreddit": "artificial"}', 7200, true),
  ('AI News RSS', 'rss', '{"feed_url": "https://rsshub.app/36kr/motif/ai"}', 3600, true);

-- Seed data: sample news items
insert into public.news_items (source_id, title, url, summary, ai_tags, ai_summary, engagement_score, published_at) values
  ((select id from public.sources where name = 'HackerNews'),
    'Claude 4.5 发布：代码生成能力大幅提升',
    'https://example.com/claude-4-5',
    'Anthropic 发布 Claude 4.5，在多项编程基准测试中取得突破',
    array['claude', 'llm', 'coding', 'anthropic'],
    'Anthropic 最新发布的 Claude 4.5 在 SWE-bench 和 HumanEval 测试中达到新高，代码生成准确率提升 30%。模型支持 200K 上下文窗口，并引入改进的工具使用能力。',
    342, '2026-04-05 10:00:00+00'),
  ((select id from public.sources where name = 'Product Hunt'),
    'Bolt.new 2.0 - AI 全栈开发平台',
    'https://example.com/bolt-new-2',
    '一键部署全栈应用，支持多框架和数据库',
    array['developer-tools', 'no-code', 'deployment'],
    'Bolt.new 2.0 发布，支持自然语言描述生成完整全栈应用，包括前端、后端和数据库。新版本增加团队协作功能和自定义域名支持。',
    256, '2026-04-04 14:00:00+00'),
  ((select id from public.sources where name = 'Reddit r/artificial'),
    '开源模型 Llama 4 性能对标 GPT-4.5',
    'https://example.com/llama-4',
    'Meta 发布 Llama 4，在多项基准测试中接近商业模型水平',
    array['open-source', 'llama', 'meta', 'llm'],
    'Meta 最新开源模型 Llama 4 在 MMLU、GSM8K 等主流基准上达到 GPT-4.5 级别表现，模型权重完全开源，社区反响热烈。',
    189, '2026-04-03 08:00:00+00'),
  ((select id from public.sources where name = 'HackerNews'),
    'AI Agent 框架大比拼：LangGraph vs CrewAI vs Claude Agent SDK',
    'https://example.com/agent-frameworks',
    '开发者实测三大 Agent 框架的优劣对比',
    array['agent', 'framework', 'langgraph', 'crewai'],
    '一位开发者用同一个任务分别测试了 LangGraph、CrewAI 和 Claude Agent SDK，从性能、灵活性、调试体验等维度做了详细对比。结论：Claude Agent SDK 在实际编码任务中表现最佳。',
    415, '2026-04-02 16:00:00+00'),
  ((select id from public.sources where name = 'AI News RSS'),
    '企业 AI 采用率达到 78%，但 ROI 仍是最大挑战',
    'https://example.com/enterprise-ai-adoption',
    'Gartner 最新报告显示企业 AI 项目面临的核心问题',
    array['enterprise', 'roi', 'adoption', 'report'],
    'Gartner 2026 Q1 报告指出，虽然 78% 的企业已部署 AI 项目，但仅 35% 实现了预期 ROI。主要障碍包括数据质量、人才缺口和组织文化。',
    127, '2026-04-01 09:00:00+00');

-- Seed data: sample demand signals
insert into public.demand_signals (news_item_id, signal_type, score, market_size_est, competition_lvl, ai_analysis) values
  ((select id from public.news_items where url = 'https://example.com/agent-frameworks'),
    'solution_req', 82, '中型 ($10M-$100M)',  'medium',
    '开发者社区对 AI Agent 框架的需求强烈，但现有方案在调试和可观测性方面存在明显不足。存在开发 Agent 调试/监控 SaaS 工具的机会。'),
  ((select id from public.news_items where url = 'https://example.com/enterprise-ai-adoption'),
    'pain_point', 91, '大型 ($100M+)', 'high',
    '企业 AI ROI 追踪是一个高分痛点。虽然竞争激烈，但现有方案过于复杂。一个轻量级、即插即用的 AI ROI 仪表盘可能是差异化切入点。'),
  ((select id from public.news_items where url = 'https://example.com/bolt-new-2'),
    'trending', 67, '中型 ($10M-$100M)', 'high',
    'AI 全栈开发工具赛道竞争激烈，但面向特定垂直行业（如电商、SaaS）的定制化 AI 开发平台可能存在细分机会。');
```

- [ ] **Step 2: 在 Supabase Dashboard 中执行迁移**

打开 Supabase Dashboard → SQL Editor → 粘贴并执行 `004_news_demands.sql`

- [ ] **Step 3: 提交**

```bash
git add supabase/migrations/004_news_demands.sql
git commit -m "feat: add news and demand signals database migration (sources, news_items, demand_signals)"
```

---

## Task 2: 更新 Database 类型

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: 在 types.ts 的 Tables 对象中添加新表类型**

在 `tool_bookmarks` 表定义之后、`Tables` 闭合括号之前，添加以下 3 个表类型：

```typescript
      sources: {
        Row: {
          id: string;
          name: string;
          type: "hn" | "ph" | "reddit" | "rss" | "x";
          config: Record<string, unknown>;
          fetch_interval: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["sources"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["sources"]["Insert"]
        >;
        Relationships: [];
      };
      news_items: {
        Row: {
          id: string;
          source_id: string;
          title: string;
          url: string;
          summary: string | null;
          content: string | null;
          ai_tags: string[];
          ai_summary: string | null;
          engagement_score: number;
          published_at: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["news_items"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["news_items"]["Insert"]
        >;
        Relationships: [];
      };
      demand_signals: {
        Row: {
          id: string;
          news_item_id: string;
          signal_type: "pain_point" | "solution_req" | "trending";
          score: number;
          market_size_est: string | null;
          competition_lvl: "low" | "medium" | "high" | null;
          ai_analysis: string | null;
          status: "active" | "archived" | "dismissed";
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["demand_signals"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["demand_signals"]["Insert"]
        >;
        Relationships: [];
      };
```

- [ ] **Step 2: 验证类型编译**

Run: `npx next build`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 3: 提交**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat: add sources, news_items, demand_signals types to Database definition"
```

---

## Task 3: 新闻卡片组件 + 测试

**Files:**
- Create: `src/components/news/news-card.tsx`
- Create: `tests/components/news/news-card.test.tsx`

- [ ] **Step 1: 编写测试**

Create `tests/components/news/news-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { NewsCard } from "@/components/news/news-card";

const mockNewsItem = {
  id: "1",
  source_id: "src-1",
  title: "Claude 4.5 发布：代码生成能力大幅提升",
  url: "https://example.com/claude-4-5",
  summary: "Anthropic 发布 Claude 4.5，在多项编程基准测试中取得突破",
  content: null,
  ai_tags: ["claude", "llm", "coding"],
  ai_summary: "Claude 4.5 在 SWE-bench 测试中达到新高",
  engagement_score: 342,
  published_at: "2026-04-05T10:00:00Z",
  created_at: "2026-04-05T10:00:00Z",
};

describe("NewsCard", () => {
  it("renders news title", () => {
    render(<NewsCard item={mockNewsItem} sourceName="HackerNews" />);
    expect(screen.getByText("Claude 4.5 发布：代码生成能力大幅提升")).toBeInTheDocument();
  });

  it("renders AI summary when available", () => {
    render(<NewsCard item={mockNewsItem} sourceName="HackerNews" />);
    expect(screen.getByText("Claude 4.5 在 SWE-bench 测试中达到新高")).toBeInTheDocument();
  });

  it("falls back to summary when no AI summary", () => {
    const item = { ...mockNewsItem, ai_summary: null };
    render(<NewsCard item={item} sourceName="HackerNews" />);
    expect(screen.getByText(/Anthropic 发布 Claude 4.5/)).toBeInTheDocument();
  });

  it("renders source name", () => {
    render(<NewsCard item={mockNewsItem} sourceName="HackerNews" />);
    expect(screen.getByText("HackerNews")).toBeInTheDocument();
  });

  it("renders AI tags", () => {
    render(<NewsCard item={mockNewsItem} sourceName="HackerNews" />);
    expect(screen.getByText("claude")).toBeInTheDocument();
    expect(screen.getByText("llm")).toBeInTheDocument();
  });

  it("renders engagement score", () => {
    render(<NewsCard item={mockNewsItem} sourceName="HackerNews" />);
    expect(screen.getByText(/342/)).toBeInTheDocument();
  });

  it("links to external URL", () => {
    render(<NewsCard item={mockNewsItem} sourceName="HackerNews" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.com/claude-4-5");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/components/news/news-card.test.tsx`
Expected: FAIL — 模块未找到

- [ ] **Step 3: 实现新闻卡片组件**

Create `src/components/news/news-card.tsx`:

```tsx
import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/types";

type NewsItem = Database["public"]["Tables"]["news_items"]["Row"];

interface NewsCardProps {
  item: NewsItem;
  sourceName: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return `${Math.floor(days / 30)} 月前`;
}

export function NewsCard({ item, sourceName }: NewsCardProps) {
  const displaySummary = item.ai_summary ?? item.summary;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <Card className="border-border bg-card p-5 transition-colors hover:border-primary/50">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
              {sourceName}
            </span>
            <span>{timeAgo(item.published_at)}</span>
            <span>🔥 {item.engagement_score}</span>
          </div>

          <h3 className="font-semibold leading-tight">{item.title}</h3>

          {displaySummary && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {displaySummary}
            </p>
          )}

          {item.ai_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.ai_tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>
    </a>
  );
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/components/news/news-card.test.tsx`
Expected: 7 tests PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/news/news-card.tsx tests/components/news/news-card.test.tsx
git commit -m "feat: add news card component with AI summary and tags"
```

---

## Task 4: 来源筛选组件 + 测试

**Files:**
- Create: `src/components/news/source-filter.tsx`
- Create: `tests/components/news/source-filter.test.tsx`

- [ ] **Step 1: 编写测试**

Create `tests/components/news/source-filter.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SourceFilter } from "@/components/news/source-filter";

const mockSources = [
  { id: "1", name: "HackerNews", type: "hn" as const, config: {}, fetch_interval: 7200, is_active: true, created_at: "" },
  { id: "2", name: "Product Hunt", type: "ph" as const, config: {}, fetch_interval: 86400, is_active: true, created_at: "" },
  { id: "3", name: "Reddit", type: "reddit" as const, config: {}, fetch_interval: 7200, is_active: true, created_at: "" },
];

describe("SourceFilter", () => {
  it("renders 全部 pill", () => {
    render(
      <SourceFilter sources={mockSources} activeSourceId={null} onSelect={() => {}} />
    );
    expect(screen.getByText("全部")).toBeInTheDocument();
  });

  it("renders all source names", () => {
    render(
      <SourceFilter sources={mockSources} activeSourceId={null} onSelect={() => {}} />
    );
    expect(screen.getByText("HackerNews")).toBeInTheDocument();
    expect(screen.getByText("Product Hunt")).toBeInTheDocument();
    expect(screen.getByText("Reddit")).toBeInTheDocument();
  });

  it("highlights active source", () => {
    render(
      <SourceFilter sources={mockSources} activeSourceId="1" onSelect={() => {}} />
    );
    const activeBtn = screen.getByText("HackerNews").closest("button");
    expect(activeBtn?.className).toContain("bg-primary");
  });

  it("calls onSelect when clicking a source", () => {
    const onSelect = vi.fn();
    render(
      <SourceFilter sources={mockSources} activeSourceId={null} onSelect={onSelect} />
    );
    fireEvent.click(screen.getByText("Product Hunt"));
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("calls onSelect with null when clicking 全部", () => {
    const onSelect = vi.fn();
    render(
      <SourceFilter sources={mockSources} activeSourceId="1" onSelect={onSelect} />
    );
    fireEvent.click(screen.getByText("全部"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/components/news/source-filter.test.tsx`
Expected: FAIL — 模块未找到

- [ ] **Step 3: 实现来源筛选组件**

Create `src/components/news/source-filter.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type Source = Database["public"]["Tables"]["sources"]["Row"];

const sourceIcons: Record<string, string> = {
  hn: "🟠",
  ph: "🐱",
  reddit: "🔵",
  rss: "📡",
  x: "𝕏",
};

interface SourceFilterProps {
  sources: Source[];
  activeSourceId: string | null;
  onSelect: (sourceId: string | null) => void;
}

export function SourceFilter({
  sources,
  activeSourceId,
  onSelect,
}: SourceFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          activeSourceId === null
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        全部
      </button>
      {sources.map((source) => (
        <button
          key={source.id}
          onClick={() => onSelect(source.id)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            activeSourceId === source.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          {sourceIcons[source.type] ?? "📰"} {source.name}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/components/news/source-filter.test.tsx`
Expected: 5 tests PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/news/source-filter.tsx tests/components/news/source-filter.test.tsx
git commit -m "feat: add source filter pills component for news filtering"
```

---

## Task 5: 需求信号卡片组件 + 测试

**Files:**
- Create: `src/components/demands/demand-card.tsx`
- Create: `tests/components/demands/demand-card.test.tsx`

- [ ] **Step 1: 编写测试**

Create `tests/components/demands/demand-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DemandCard } from "@/components/demands/demand-card";

const mockSignal = {
  id: "1",
  news_item_id: "n1",
  signal_type: "pain_point" as const,
  score: 91,
  market_size_est: "大型 ($100M+)",
  competition_lvl: "high" as const,
  ai_analysis: "企业 AI ROI 追踪是一个高分痛点",
  status: "active" as const,
  created_at: "2026-04-01T00:00:00Z",
};

const mockNewsTitle = "企业 AI 采用率达到 78%";

describe("DemandCard", () => {
  it("renders signal type label", () => {
    render(<DemandCard signal={mockSignal} newsTitle={mockNewsTitle} />);
    expect(screen.getByText("痛点需求")).toBeInTheDocument();
  });

  it("renders score", () => {
    render(<DemandCard signal={mockSignal} newsTitle={mockNewsTitle} />);
    expect(screen.getByText("91")).toBeInTheDocument();
  });

  it("renders AI analysis", () => {
    render(<DemandCard signal={mockSignal} newsTitle={mockNewsTitle} />);
    expect(screen.getByText(/企业 AI ROI 追踪/)).toBeInTheDocument();
  });

  it("renders market size", () => {
    render(<DemandCard signal={mockSignal} newsTitle={mockNewsTitle} />);
    expect(screen.getByText(/大型/)).toBeInTheDocument();
  });

  it("renders competition level", () => {
    render(<DemandCard signal={mockSignal} newsTitle={mockNewsTitle} />);
    expect(screen.getByText("竞争: 高")).toBeInTheDocument();
  });

  it("renders related news title", () => {
    render(<DemandCard signal={mockSignal} newsTitle={mockNewsTitle} />);
    expect(screen.getByText(/企业 AI 采用率/)).toBeInTheDocument();
  });

  it("renders solution_req type label correctly", () => {
    const signal = { ...mockSignal, signal_type: "solution_req" as const };
    render(<DemandCard signal={signal} newsTitle={mockNewsTitle} />);
    expect(screen.getByText("方案需求")).toBeInTheDocument();
  });

  it("renders trending type label correctly", () => {
    const signal = { ...mockSignal, signal_type: "trending" as const };
    render(<DemandCard signal={signal} newsTitle={mockNewsTitle} />);
    expect(screen.getByText("趋势需求")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/components/demands/demand-card.test.tsx`
Expected: FAIL — 模块未找到

- [ ] **Step 3: 实现需求信号卡片**

Create `src/components/demands/demand-card.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/types";

type DemandSignal = Database["public"]["Tables"]["demand_signals"]["Row"];

interface DemandCardProps {
  signal: DemandSignal;
  newsTitle: string;
}

const signalTypeLabels: Record<DemandSignal["signal_type"], string> = {
  pain_point: "痛点需求",
  solution_req: "方案需求",
  trending: "趋势需求",
};

const signalTypeColors: Record<DemandSignal["signal_type"], string> = {
  pain_point: "bg-red-500/10 text-red-500",
  solution_req: "bg-blue-500/10 text-blue-500",
  trending: "bg-green-500/10 text-green-500",
};

const competitionLabels: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 50) return "text-yellow-500";
  return "text-muted-foreground";
}

export function DemandCard({ signal, newsTitle }: DemandCardProps) {
  return (
    <Card className="border-border bg-card p-5">
      <div className="flex items-start gap-4">
        {/* Score */}
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-lg font-bold ${scoreColor(signal.score)}`}
        >
          {signal.score}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${signalTypeColors[signal.signal_type]}`}
            >
              {signalTypeLabels[signal.signal_type]}
            </span>
            {signal.market_size_est && (
              <Badge variant="outline" className="text-xs">
                {signal.market_size_est}
              </Badge>
            )}
            {signal.competition_lvl && (
              <span className="text-xs text-muted-foreground">
                竞争: {competitionLabels[signal.competition_lvl] ?? signal.competition_lvl}
              </span>
            )}
          </div>

          {signal.ai_analysis && (
            <p className="text-sm leading-relaxed">
              {signal.ai_analysis}
            </p>
          )}

          <div className="text-xs text-muted-foreground">
            📰 来源: {newsTitle}
          </div>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/components/demands/demand-card.test.tsx`
Expected: 8 tests PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/demands/demand-card.tsx tests/components/demands/demand-card.test.tsx
git commit -m "feat: add demand signal card component with score and analysis display"
```

---

## Task 6: 需求筛选组件 + 测试

**Files:**
- Create: `src/components/demands/demand-filters.tsx`
- Create: `tests/components/demands/demand-filters.test.tsx`

- [ ] **Step 1: 编写测试**

Create `tests/components/demands/demand-filters.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DemandFilters } from "@/components/demands/demand-filters";

describe("DemandFilters", () => {
  it("renders signal type filter buttons", () => {
    render(
      <DemandFilters
        activeType={null}
        sortBy="score"
        onTypeChange={() => {}}
        onSortChange={() => {}}
      />
    );
    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("痛点需求")).toBeInTheDocument();
    expect(screen.getByText("方案需求")).toBeInTheDocument();
    expect(screen.getByText("趋势需求")).toBeInTheDocument();
  });

  it("highlights active type", () => {
    render(
      <DemandFilters
        activeType="pain_point"
        sortBy="score"
        onTypeChange={() => {}}
        onSortChange={() => {}}
      />
    );
    const activeBtn = screen.getByText("痛点需求").closest("button");
    expect(activeBtn?.className).toContain("bg-primary");
  });

  it("calls onTypeChange when clicking a type", () => {
    const onTypeChange = vi.fn();
    render(
      <DemandFilters
        activeType={null}
        sortBy="score"
        onTypeChange={onTypeChange}
        onSortChange={() => {}}
      />
    );
    fireEvent.click(screen.getByText("方案需求"));
    expect(onTypeChange).toHaveBeenCalledWith("solution_req");
  });

  it("renders sort options", () => {
    render(
      <DemandFilters
        activeType={null}
        sortBy="score"
        onTypeChange={() => {}}
        onSortChange={() => {}}
      />
    );
    expect(screen.getByText("按评分")).toBeInTheDocument();
    expect(screen.getByText("按时间")).toBeInTheDocument();
  });

  it("calls onSortChange when clicking sort option", () => {
    const onSortChange = vi.fn();
    render(
      <DemandFilters
        activeType={null}
        sortBy="score"
        onTypeChange={() => {}}
        onSortChange={onSortChange}
      />
    );
    fireEvent.click(screen.getByText("按时间"));
    expect(onSortChange).toHaveBeenCalledWith("date");
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/components/demands/demand-filters.test.tsx`
Expected: FAIL — 模块未找到

- [ ] **Step 3: 实现需求筛选组件**

Create `src/components/demands/demand-filters.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type SignalType = Database["public"]["Tables"]["demand_signals"]["Row"]["signal_type"];
export type SortBy = "score" | "date";

interface DemandFiltersProps {
  activeType: SignalType | null;
  sortBy: SortBy;
  onTypeChange: (type: SignalType | null) => void;
  onSortChange: (sort: SortBy) => void;
}

const typeOptions: { key: SignalType | null; label: string }[] = [
  { key: null, label: "全部" },
  { key: "pain_point", label: "痛点需求" },
  { key: "solution_req", label: "方案需求" },
  { key: "trending", label: "趋势需求" },
];

const sortOptions: { key: SortBy; label: string }[] = [
  { key: "score", label: "按评分" },
  { key: "date", label: "按时间" },
];

export function DemandFilters({
  activeType,
  sortBy,
  onTypeChange,
  onSortChange,
}: DemandFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        {typeOptions.map((opt) => (
          <button
            key={opt.key ?? "all"}
            onClick={() => onTypeChange(opt.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              activeType === opt.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {sortOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => {
              if (opt.key !== sortBy) onSortChange(opt.key);
            }}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              sortBy === opt.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/components/demands/demand-filters.test.tsx`
Expected: 5 tests PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/demands/demand-filters.tsx tests/components/demands/demand-filters.test.tsx
git commit -m "feat: add demand filters component (type pills + sort toggle)"
```

---

## Task 7: AI 新鲜事页面

**Files:**
- Create: `src/app/news/page.tsx`
- Create: `src/app/news/news-page-client.tsx`

- [ ] **Step 1: 创建服务端数据获取页面**

Create `src/app/news/page.tsx`:

```tsx
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
```

- [ ] **Step 2: 创建客户端交互组件**

Create `src/app/news/news-page-client.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { NewsCard } from "@/components/news/news-card";
import { SourceFilter } from "@/components/news/source-filter";
import type { Database } from "@/lib/supabase/types";

type Source = Database["public"]["Tables"]["sources"]["Row"];
type NewsItem = Database["public"]["Tables"]["news_items"]["Row"];

interface NewsPageClientProps {
  sources: Source[];
  newsItems: NewsItem[];
}

export function NewsPageClient({
  sources,
  newsItems,
}: NewsPageClientProps) {
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  // Build source name map
  const sourceNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sources) {
      map.set(s.id, s.name);
    }
    return map;
  }, [sources]);

  // Filter by source
  const filteredItems = useMemo(() => {
    if (!activeSourceId) return newsItems;
    return newsItems.filter((item) => item.source_id === activeSourceId);
  }, [newsItems, activeSourceId]);

  return (
    <div className="space-y-6">
      <SourceFilter
        sources={sources}
        activeSourceId={activeSourceId}
        onSelect={setActiveSourceId}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((item) => (
          <NewsCard
            key={item.id}
            item={item}
            sourceName={sourceNameMap.get(item.source_id) ?? "未知来源"}
          />
        ))}
        {filteredItems.length === 0 && (
          <p className="col-span-full py-8 text-center text-muted-foreground">
            暂无新闻
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add src/app/news/
git commit -m "feat: add AI news page with source filtering and news card grid"
```

---

## Task 8: 需求 Hub 页面

**Files:**
- Create: `src/app/demands/page.tsx`
- Create: `src/app/demands/demands-page-client.tsx`

- [ ] **Step 1: 创建服务端数据获取页面**

Create `src/app/demands/page.tsx`:

```tsx
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
```

- [ ] **Step 2: 创建客户端交互组件**

Create `src/app/demands/demands-page-client.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { DemandCard } from "@/components/demands/demand-card";
import {
  DemandFilters,
  type SortBy,
} from "@/components/demands/demand-filters";
import type { Database } from "@/lib/supabase/types";

type DemandSignal = Database["public"]["Tables"]["demand_signals"]["Row"];
type SignalType = DemandSignal["signal_type"];

interface DemandsPageClientProps {
  signals: DemandSignal[];
  newsTitleMap: Record<string, string>;
}

export function DemandsPageClient({
  signals,
  newsTitleMap,
}: DemandsPageClientProps) {
  const [activeType, setActiveType] = useState<SignalType | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("score");

  const filteredSignals = useMemo(() => {
    let result = signals;

    // Type filter
    if (activeType) {
      result = result.filter((s) => s.signal_type === activeType);
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === "score") return b.score - a.score;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    return result;
  }, [signals, activeType, sortBy]);

  return (
    <div className="space-y-6">
      <DemandFilters
        activeType={activeType}
        sortBy={sortBy}
        onTypeChange={setActiveType}
        onSortChange={setSortBy}
      />

      <div className="space-y-4">
        {filteredSignals.map((signal) => (
          <DemandCard
            key={signal.id}
            signal={signal}
            newsTitle={
              newsTitleMap[signal.news_item_id] ?? "未知来源"
            }
          />
        ))}
        {filteredSignals.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            暂无需求信号
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add src/app/demands/
git commit -m "feat: add demand hub page with type filtering and score sorting"
```

---

## Task 9: 端到端验证

**Files:**
- No new files

- [ ] **Step 1: 运行所有测试**

```bash
npx vitest run
```

Expected: 所有测试通过（含新增的 news-card, source-filter, demand-card, demand-filters 测试）

- [ ] **Step 2: 构建检查**

```bash
npx next build
```

Expected: 构建成功，新增路由 `/news` 和 `/demands`

- [ ] **Step 3: 验证路由输出**

构建输出中应包含：

```
Route (app)
├ ○ /
├ ƒ /news
├ ƒ /demands
├ ƒ /tools
├ ƒ /tools/[slug]
├ ƒ /tutorials
├ ƒ /tutorials/[category]
└ ƒ /tutorials/[category]/[slug]
```

- [ ] **Step 4: 提交最终修复（如有）**

如果有任何类型修复或构建修复，提交：

```bash
git add -A
git commit -m "fix: resolve build issues for news and demand hub module"
```
