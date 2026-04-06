# Plan 2: AI 工具榜 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 AI 工具榜模块：数据库表、工具列表/详情页面、分类筛选、多维度排名（月度榜/分类榜/增长榜/新工具）、用户收藏功能。

**Architecture:** 新增 4 张 Supabase 表（tool_categories, ai_tools, tool_rankings, tool_bookmarks），前端使用 ISR (1h) 渲染工具列表，客户端动态切换 Tab 和筛选。工具详情页展示完整信息 + 排名趋势。收藏功能需要登录态。

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Supabase (PostgreSQL + RLS), Vitest

**Spec Reference:** `docs/superpowers/specs/2026-04-05-lighthouse-design.md` §4.2 AI 工具榜

---

## File Structure

```
src/
├── lib/supabase/types.ts                          # 修改: 新增 tool_categories, ai_tools, tool_rankings, tool_bookmarks 类型
├── app/tools/
│   ├── page.tsx                                   # 工具榜主页 (Tab 切换 + 分类筛选 + 工具列表)
│   └── [slug]/page.tsx                            # 工具详情页
├── components/tools/
│   ├── tool-card.tsx                              # 工具卡片组件
│   ├── tool-category-filter.tsx                   # 分类筛选侧边栏
│   ├── ranking-tabs.tsx                           # 榜单 Tab 切换 (月度/分类/增长/新工具)
│   └── bookmark-button.tsx                        # 收藏按钮 (客户端组件)
tests/
├── components/tools/
│   ├── tool-card.test.tsx
│   ├── tool-category-filter.test.tsx
│   └── ranking-tabs.test.tsx
supabase/
└── migrations/
    └── 003_ai_tools.sql                           # tool_categories + ai_tools + tool_rankings + tool_bookmarks
```

---

## Task 1: 数据库迁移 — AI 工具表

**Files:**
- Create: `supabase/migrations/003_ai_tools.sql`

- [ ] **Step 1: 创建迁移文件**

Create `supabase/migrations/003_ai_tools.sql`:

```sql
-- Tool categories (tree structure, same pattern as tutorial categories)
create table public.tool_categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  parent_id uuid references public.tool_categories(id),
  "order" integer default 0,
  created_at timestamptz default now()
);

alter table public.tool_categories enable row level security;

create policy "Tool categories are viewable by everyone"
  on public.tool_categories for select using (true);

-- AI tools
create table public.ai_tools (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text not null unique,
  url text not null,
  description text,
  logo_url text,
  category_id uuid references public.tool_categories(id),
  pricing_model text default 'free' check (pricing_model in ('free', 'freemium', 'paid', 'open_source')),
  features jsonb default '[]',
  tags text[] default '{}',
  verified boolean default false,
  status text default 'published' check (status in ('draft', 'published')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.ai_tools enable row level security;

create policy "Published tools are viewable by everyone"
  on public.ai_tools for select using (status = 'published');

-- Full-text search index on name + description
create index ai_tools_search_idx on public.ai_tools
  using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '')));

-- GIN index on features and tags
create index ai_tools_tags_idx on public.ai_tools using gin (tags);
create index ai_tools_features_idx on public.ai_tools using gin (features);

-- Tool rankings (monthly snapshots)
create table public.tool_rankings (
  id uuid default gen_random_uuid() primary key,
  tool_id uuid references public.ai_tools(id) on delete cascade not null,
  period text not null, -- format: '2026-04'
  monthly_visits bigint default 0,
  growth_rate numeric(8,4) default 0, -- percentage, e.g. 15.5 = 15.5%
  rank integer,
  category_rank integer,
  created_at timestamptz default now(),
  unique(tool_id, period)
);

alter table public.tool_rankings enable row level security;

create policy "Rankings are viewable by everyone"
  on public.tool_rankings for select using (true);

create index tool_rankings_period_rank_idx on public.tool_rankings (period, rank);
create index tool_rankings_period_growth_idx on public.tool_rankings (period, growth_rate desc);

-- Tool bookmarks
create table public.tool_bookmarks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  tool_id uuid references public.ai_tools(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, tool_id)
);

alter table public.tool_bookmarks enable row level security;

create policy "Users can view own bookmarks"
  on public.tool_bookmarks for select using (auth.uid() = user_id);

create policy "Users can insert own bookmarks"
  on public.tool_bookmarks for insert with check (auth.uid() = user_id);

create policy "Users can delete own bookmarks"
  on public.tool_bookmarks for delete using (auth.uid() = user_id);

-- Seed data: tool categories
insert into public.tool_categories (name, slug, icon, "order") values
  ('文本生成', 'text-generation', '✍️', 1),
  ('图像生成', 'image-generation', '🎨', 2),
  ('视频生成', 'video-generation', '🎬', 3),
  ('音频/语音', 'audio-voice', '🎵', 4),
  ('编程助手', 'coding-assistant', '💻', 5),
  ('数据分析', 'data-analysis', '📊', 6),
  ('办公效率', 'productivity', '📋', 7),
  ('设计工具', 'design-tools', '🖌️', 8);

-- Seed data: sample tools
insert into public.ai_tools (name, slug, url, description, category_id, pricing_model, tags, verified) values
  ('ChatGPT', 'chatgpt', 'https://chat.openai.com', 'OpenAI 的对话式 AI 助手，支持文本生成、代码编写、数据分析等多种任务',
    (select id from public.tool_categories where slug = 'text-generation'), 'freemium', array['chatbot', 'writing', 'coding'], true),
  ('Claude', 'claude', 'https://claude.ai', 'Anthropic 的 AI 助手，擅长长文本理解、代码生成和深度分析',
    (select id from public.tool_categories where slug = 'text-generation'), 'freemium', array['chatbot', 'writing', 'coding', 'analysis'], true),
  ('Midjourney', 'midjourney', 'https://midjourney.com', '高质量 AI 图像生成工具，擅长艺术风格和创意设计',
    (select id from public.tool_categories where slug = 'image-generation'), 'paid', array['image', 'art', 'design'], true),
  ('Cursor', 'cursor', 'https://cursor.sh', 'AI 驱动的代码编辑器，内置智能补全和代码生成',
    (select id from public.tool_categories where slug = 'coding-assistant'), 'freemium', array['coding', 'ide', 'autocomplete'], true),
  ('Runway', 'runway', 'https://runwayml.com', 'AI 视频生成和编辑平台，支持文本/图像到视频',
    (select id from public.tool_categories where slug = 'video-generation'), 'freemium', array['video', 'editing', 'generation'], true);

-- Seed data: sample rankings for current period
insert into public.tool_rankings (tool_id, period, monthly_visits, growth_rate, rank, category_rank) values
  ((select id from public.ai_tools where slug = 'chatgpt'), '2026-04', 1800000000, 2.3, 1, 1),
  ((select id from public.ai_tools where slug = 'claude'), '2026-04', 120000000, 18.5, 2, 2),
  ((select id from public.ai_tools where slug = 'midjourney'), '2026-04', 50000000, -5.2, 3, 1),
  ((select id from public.ai_tools where slug = 'cursor'), '2026-04', 30000000, 45.0, 4, 1),
  ((select id from public.ai_tools where slug = 'runway'), '2026-04', 15000000, 12.8, 5, 1);
```

- [ ] **Step 2: 在 Supabase Dashboard 中执行迁移**

打开 Supabase Dashboard → SQL Editor → 粘贴并执行 `003_ai_tools.sql`

- [ ] **Step 3: 提交**

```bash
git add supabase/migrations/003_ai_tools.sql
git commit -m "feat: add AI tools database migration (tool_categories, ai_tools, tool_rankings, tool_bookmarks)"
```

---

## Task 2: 更新 Database 类型

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: 在 types.ts 的 Tables 对象中添加新表类型**

在 `user_usage` 表定义之后、`Tables` 闭合括号之前，添加以下 4 个表类型：

```typescript
      tool_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          icon: string | null;
          parent_id: string | null;
          order: number;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["tool_categories"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["tool_categories"]["Insert"]
        >;
        Relationships: [];
      };
      ai_tools: {
        Row: {
          id: string;
          name: string;
          slug: string;
          url: string;
          description: string | null;
          logo_url: string | null;
          category_id: string | null;
          pricing_model: "free" | "freemium" | "paid" | "open_source";
          features: unknown[];
          tags: string[];
          verified: boolean;
          status: "draft" | "published";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["ai_tools"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["ai_tools"]["Insert"]
        >;
        Relationships: [];
      };
      tool_rankings: {
        Row: {
          id: string;
          tool_id: string;
          period: string;
          monthly_visits: number;
          growth_rate: number;
          rank: number | null;
          category_rank: number | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["tool_rankings"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["tool_rankings"]["Insert"]
        >;
        Relationships: [];
      };
      tool_bookmarks: {
        Row: {
          id: string;
          user_id: string;
          tool_id: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["tool_bookmarks"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["tool_bookmarks"]["Insert"]
        >;
        Relationships: [];
      };
```

- [ ] **Step 2: 验证类型编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat: add AI tools types to Database definition"
```

---

## Task 3: 工具卡片组件 + 测试

**Files:**
- Create: `src/components/tools/tool-card.tsx`
- Create: `tests/components/tools/tool-card.test.tsx`

- [ ] **Step 1: 编写测试**

Create `tests/components/tools/tool-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ToolCard } from "@/components/tools/tool-card";

const mockTool = {
  id: "1",
  name: "ChatGPT",
  slug: "chatgpt",
  url: "https://chat.openai.com",
  description: "OpenAI 的对话式 AI 助手",
  logo_url: null,
  category_id: "cat-1",
  pricing_model: "freemium" as const,
  features: [],
  tags: ["chatbot", "writing"],
  verified: true,
  status: "published" as const,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

const mockRanking = {
  id: "r1",
  tool_id: "1",
  period: "2026-04",
  monthly_visits: 1800000000,
  growth_rate: 2.3,
  rank: 1,
  category_rank: 1,
  created_at: "2026-04-01",
};

describe("ToolCard", () => {
  it("renders tool name", () => {
    render(<ToolCard tool={mockTool} ranking={mockRanking} />);
    expect(screen.getByText("ChatGPT")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<ToolCard tool={mockTool} ranking={mockRanking} />);
    expect(screen.getByText("OpenAI 的对话式 AI 助手")).toBeInTheDocument();
  });

  it("renders pricing model badge", () => {
    render(<ToolCard tool={mockTool} ranking={mockRanking} />);
    expect(screen.getByText("freemium")).toBeInTheDocument();
  });

  it("renders rank number", () => {
    render(<ToolCard tool={mockTool} ranking={mockRanking} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
  });

  it("renders monthly visits formatted", () => {
    render(<ToolCard tool={mockTool} ranking={mockRanking} />);
    expect(screen.getByText(/18.0 亿/)).toBeInTheDocument();
  });

  it("renders growth rate with arrow", () => {
    render(<ToolCard tool={mockTool} ranking={mockRanking} />);
    expect(screen.getByText(/2.3%/)).toBeInTheDocument();
  });

  it("renders without ranking gracefully", () => {
    render(<ToolCard tool={mockTool} />);
    expect(screen.getByText("ChatGPT")).toBeInTheDocument();
  });

  it("shows verified badge when verified", () => {
    render(<ToolCard tool={mockTool} ranking={mockRanking} />);
    expect(screen.getByText("✓")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/components/tools/tool-card.test.tsx`
Expected: FAIL — 模块未找到

- [ ] **Step 3: 实现 tool-card 组件**

Create `src/components/tools/tool-card.tsx`:

```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/types";

type Tool = Database["public"]["Tables"]["ai_tools"]["Row"];
type Ranking = Database["public"]["Tables"]["tool_rankings"]["Row"];

interface ToolCardProps {
  tool: Tool;
  ranking?: Ranking;
}

function formatVisits(visits: number): string {
  if (visits >= 1_000_000_000) return `${(visits / 1_000_000_000).toFixed(1)} 亿`;
  if (visits >= 10_000_000) return `${(visits / 10_000_000).toFixed(1)} 千万`;
  if (visits >= 10_000) return `${(visits / 10_000).toFixed(1)} 万`;
  return visits.toLocaleString();
}

export function ToolCard({ tool, ranking }: ToolCardProps) {
  return (
    <Link href={`/tools/${tool.slug}`}>
      <Card className="border-border bg-card p-5 transition-colors hover:border-primary/50">
        <div className="flex items-start gap-4">
          {/* Rank */}
          {ranking?.rank && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
              #{ranking.rank}
            </div>
          )}

          {/* Logo placeholder */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
            {tool.name.charAt(0)}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold leading-tight">{tool.name}</h3>
              {tool.verified && (
                <span className="text-xs text-primary" title="已认证">
                  ✓
                </span>
              )}
              <Badge variant="outline" className="text-xs">
                {tool.pricing_model}
              </Badge>
            </div>

            {tool.description && (
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {tool.description}
              </p>
            )}

            {/* Tags */}
            {tool.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tool.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Ranking stats */}
            {ranking && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>📊 {formatVisits(ranking.monthly_visits)}</span>
                <span
                  className={
                    ranking.growth_rate > 0
                      ? "text-green-500"
                      : ranking.growth_rate < 0
                        ? "text-red-500"
                        : ""
                  }
                >
                  {ranking.growth_rate > 0 ? "↑" : ranking.growth_rate < 0 ? "↓" : "→"}{" "}
                  {Math.abs(ranking.growth_rate)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/components/tools/tool-card.test.tsx`
Expected: 8 tests PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/tools/tool-card.tsx tests/components/tools/tool-card.test.tsx
git commit -m "feat: add tool card component with ranking display"
```

---

## Task 4: 分类筛选组件 + 测试

**Files:**
- Create: `src/components/tools/tool-category-filter.tsx`
- Create: `tests/components/tools/tool-category-filter.test.tsx`

- [ ] **Step 1: 编写测试**

Create `tests/components/tools/tool-category-filter.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ToolCategoryFilter } from "@/components/tools/tool-category-filter";

const mockCategories = [
  { id: "1", name: "文本生成", slug: "text-generation", description: null, icon: "✍️", parent_id: null, order: 1, created_at: "" },
  { id: "2", name: "图像生成", slug: "image-generation", description: null, icon: "🎨", parent_id: null, order: 2, created_at: "" },
  { id: "3", name: "编程助手", slug: "coding-assistant", description: null, icon: "💻", parent_id: null, order: 3, created_at: "" },
];

describe("ToolCategoryFilter", () => {
  it("renders all categories", () => {
    render(
      <ToolCategoryFilter
        categories={mockCategories}
        activeSlug={null}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText("文本生成")).toBeInTheDocument();
    expect(screen.getByText("图像生成")).toBeInTheDocument();
    expect(screen.getByText("编程助手")).toBeInTheDocument();
  });

  it("renders 全部 option", () => {
    render(
      <ToolCategoryFilter
        categories={mockCategories}
        activeSlug={null}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText("全部")).toBeInTheDocument();
  });

  it("highlights active category", () => {
    render(
      <ToolCategoryFilter
        categories={mockCategories}
        activeSlug="text-generation"
        onSelect={() => {}}
      />
    );
    const activeBtn = screen.getByText("文本生成").closest("button");
    expect(activeBtn?.className).toContain("bg-muted");
  });

  it("calls onSelect when clicking a category", () => {
    const onSelect = vi.fn();
    render(
      <ToolCategoryFilter
        categories={mockCategories}
        activeSlug={null}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByText("图像生成"));
    expect(onSelect).toHaveBeenCalledWith("image-generation");
  });

  it("calls onSelect with null when clicking 全部", () => {
    const onSelect = vi.fn();
    render(
      <ToolCategoryFilter
        categories={mockCategories}
        activeSlug="text-generation"
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByText("全部"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/components/tools/tool-category-filter.test.tsx`
Expected: FAIL — 模块未找到

- [ ] **Step 3: 实现分类筛选组件**

Create `src/components/tools/tool-category-filter.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type ToolCategory = Database["public"]["Tables"]["tool_categories"]["Row"];

interface ToolCategoryFilterProps {
  categories: ToolCategory[];
  activeSlug: string | null;
  onSelect: (slug: string | null) => void;
}

export function ToolCategoryFilter({
  categories,
  activeSlug,
  onSelect,
}: ToolCategoryFilterProps) {
  return (
    <div className="space-y-1">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        工具分类
      </h3>
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
          activeSlug === null
            ? "bg-muted font-medium text-primary"
            : "text-muted-foreground"
        )}
      >
        全部
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.slug)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
            activeSlug === cat.slug
              ? "bg-muted font-medium text-primary"
              : "text-muted-foreground"
          )}
        >
          {cat.icon && <span>{cat.icon}</span>}
          <span>{cat.name}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/components/tools/tool-category-filter.test.tsx`
Expected: 5 tests PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/tools/tool-category-filter.tsx tests/components/tools/tool-category-filter.test.tsx
git commit -m "feat: add tool category filter component"
```

---

## Task 5: 榜单 Tab 切换组件 + 测试

**Files:**
- Create: `src/components/tools/ranking-tabs.tsx`
- Create: `tests/components/tools/ranking-tabs.test.tsx`

- [ ] **Step 1: 编写测试**

Create `tests/components/tools/ranking-tabs.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RankingTabs, type RankingTab } from "@/components/tools/ranking-tabs";

describe("RankingTabs", () => {
  it("renders all tab options", () => {
    render(<RankingTabs activeTab="monthly" onTabChange={() => {}} />);
    expect(screen.getByText("月度榜")).toBeInTheDocument();
    expect(screen.getByText("增长榜")).toBeInTheDocument();
    expect(screen.getByText("新工具")).toBeInTheDocument();
  });

  it("highlights active tab", () => {
    render(<RankingTabs activeTab="growth" onTabChange={() => {}} />);
    const activeBtn = screen.getByText("增长榜").closest("button");
    expect(activeBtn?.className).toContain("border-primary");
  });

  it("calls onTabChange when clicking a tab", () => {
    const onTabChange = vi.fn();
    render(<RankingTabs activeTab="monthly" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText("增长榜"));
    expect(onTabChange).toHaveBeenCalledWith("growth");
  });

  it("does not re-fire onTabChange for already active tab", () => {
    const onTabChange = vi.fn();
    render(<RankingTabs activeTab="monthly" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText("月度榜"));
    expect(onTabChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/components/tools/ranking-tabs.test.tsx`
Expected: FAIL — 模块未找到

- [ ] **Step 3: 实现 Tab 切换组件**

Create `src/components/tools/ranking-tabs.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";

export type RankingTab = "monthly" | "growth" | "new";

interface RankingTabsProps {
  activeTab: RankingTab;
  onTabChange: (tab: RankingTab) => void;
}

const tabs: { key: RankingTab; label: string; icon: string }[] = [
  { key: "monthly", label: "月度榜", icon: "🏆" },
  { key: "growth", label: "增长榜", icon: "📈" },
  { key: "new", label: "新工具", icon: "🆕" },
];

export function RankingTabs({ activeTab, onTabChange }: RankingTabsProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => {
            if (tab.key !== activeTab) onTabChange(tab.key);
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            activeTab === tab.key
              ? "border border-primary bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/components/tools/ranking-tabs.test.tsx`
Expected: 4 tests PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/tools/ranking-tabs.tsx tests/components/tools/ranking-tabs.test.tsx
git commit -m "feat: add ranking tabs component (monthly/growth/new)"
```

---

## Task 6: 收藏按钮组件

**Files:**
- Create: `src/components/tools/bookmark-button.tsx`

- [ ] **Step 1: 创建收藏按钮客户端组件**

Create `src/components/tools/bookmark-button.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface BookmarkButtonProps {
  toolId: string;
  initialBookmarked: boolean;
  userId: string | null;
}

export function BookmarkButton({
  toolId,
  initialBookmarked,
  userId,
}: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    if (!userId) {
      window.location.href = "/login";
      return;
    }

    startTransition(async () => {
      const supabase = createClient();

      if (bookmarked) {
        await supabase
          .from("tool_bookmarks")
          .delete()
          .eq("user_id", userId)
          .eq("tool_id", toolId);
        setBookmarked(false);
      } else {
        await supabase
          .from("tool_bookmarks")
          .insert({ user_id: userId, tool_id: toolId });
        setBookmarked(true);
      }
    });
  }

  return (
    <Button
      variant={bookmarked ? "default" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
    >
      {bookmarked ? "★ 已收藏" : "☆ 收藏"}
    </Button>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/components/tools/bookmark-button.tsx
git commit -m "feat: add bookmark button component for tool favorites"
```

---

## Task 7: 工具榜主页

**Files:**
- Create: `src/app/tools/page.tsx`

- [ ] **Step 1: 创建工具榜主页**

Create `src/app/tools/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { ToolsPageClient } from "./tools-page-client";

export const revalidate = 3600;

export default async function ToolsPage() {
  const supabase = await createClient();

  const [
    { data: categories },
    { data: tools },
    { data: rankings },
  ] = await Promise.all([
    supabase.from("tool_categories").select("*").order("order"),
    supabase.from("ai_tools").select("*").eq("status", "published").order("name"),
    supabase.from("tool_rankings").select("*").order("rank"),
  ]);

  // Determine latest period from rankings
  const latestPeriod = rankings?.[0]?.period ?? null;
  const latestRankings = latestPeriod
    ? rankings!.filter((r) => r.period === latestPeriod)
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">AI 工具榜</h1>
        <p className="mt-2 text-muted-foreground">
          发现最佳 AI 工具，多维度排名助你选择
        </p>
      </div>

      <ToolsPageClient
        categories={categories ?? []}
        tools={tools ?? []}
        rankings={latestRankings}
      />
    </div>
  );
}
```

- [ ] **Step 2: 创建客户端交互组件**

Create `src/app/tools/tools-page-client.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { ToolCard } from "@/components/tools/tool-card";
import { ToolCategoryFilter } from "@/components/tools/tool-category-filter";
import { RankingTabs, type RankingTab } from "@/components/tools/ranking-tabs";
import type { Database } from "@/lib/supabase/types";

type Tool = Database["public"]["Tables"]["ai_tools"]["Row"];
type ToolCategory = Database["public"]["Tables"]["tool_categories"]["Row"];
type Ranking = Database["public"]["Tables"]["tool_rankings"]["Row"];

interface ToolsPageClientProps {
  categories: ToolCategory[];
  tools: Tool[];
  rankings: Ranking[];
}

export function ToolsPageClient({
  categories,
  tools,
  rankings,
}: ToolsPageClientProps) {
  const [activeTab, setActiveTab] = useState<RankingTab>("monthly");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Build tool-id to ranking map
  const rankingMap = useMemo(() => {
    const map = new Map<string, Ranking>();
    for (const r of rankings) {
      map.set(r.tool_id, r);
    }
    return map;
  }, [rankings]);

  // Filter and sort tools based on active tab + category
  const filteredTools = useMemo(() => {
    let result = tools;

    // Category filter
    if (activeCategory) {
      const cat = categories.find((c) => c.slug === activeCategory);
      if (cat) {
        result = result.filter((t) => t.category_id === cat.id);
      }
    }

    // Sort based on tab
    switch (activeTab) {
      case "monthly":
        result = [...result].sort((a, b) => {
          const ra = rankingMap.get(a.id)?.rank ?? 9999;
          const rb = rankingMap.get(b.id)?.rank ?? 9999;
          return ra - rb;
        });
        break;
      case "growth":
        result = [...result].sort((a, b) => {
          const ga = rankingMap.get(a.id)?.growth_rate ?? 0;
          const gb = rankingMap.get(b.id)?.growth_rate ?? 0;
          return gb - ga;
        });
        break;
      case "new":
        result = [...result].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
    }

    return result;
  }, [tools, rankings, activeTab, activeCategory, categories, rankingMap]);

  return (
    <div className="flex gap-8">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <ToolCategoryFilter
          categories={categories}
          activeSlug={activeCategory}
          onSelect={setActiveCategory}
        />
      </aside>

      {/* Main content */}
      <div className="flex-1">
        <div className="mb-6">
          <RankingTabs activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        <div className="space-y-3">
          {filteredTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              ranking={rankingMap.get(tool.id)}
            />
          ))}
          {filteredTools.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              暂无符合条件的工具
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add src/app/tools/
git commit -m "feat: add tools ranking page with tabs, category filter, and tool list"
```

---

## Task 8: 工具详情页

**Files:**
- Create: `src/app/tools/[slug]/page.tsx`

- [ ] **Step 1: 创建工具详情页**

Create `src/app/tools/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookmarkButton } from "@/components/tools/bookmark-button";

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

function formatVisits(visits: number): string {
  if (visits >= 1_000_000_000) return `${(visits / 1_000_000_000).toFixed(1)} 亿`;
  if (visits >= 10_000_000) return `${(visits / 10_000_000).toFixed(1)} 千万`;
  if (visits >= 10_000) return `${(visits / 10_000).toFixed(1)} 万`;
  return visits.toLocaleString();
}

export default async function ToolDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: tool } = await supabase
    .from("ai_tools")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!tool) notFound();

  // Fetch category name, rankings, and auth state
  const [{ data: category }, { data: rankings }, { data: { user } }] =
    await Promise.all([
      tool.category_id
        ? supabase
            .from("tool_categories")
            .select("name, slug")
            .eq("id", tool.category_id)
            .single()
        : Promise.resolve({ data: null }),
      supabase
        .from("tool_rankings")
        .select("*")
        .eq("tool_id", tool.id)
        .order("period", { ascending: false })
        .limit(6),
      supabase.auth.getUser(),
    ]);

  const latestRanking = rankings?.[0] ?? null;

  // Check if user has bookmarked
  let isBookmarked = false;
  if (user) {
    const { data: bookmark } = await supabase
      .from("tool_bookmarks")
      .select("id")
      .eq("user_id", user.id)
      .eq("tool_id", tool.id)
      .single();
    isBookmarked = !!bookmark;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6 text-sm text-muted-foreground">
        <Link href="/tools" className="hover:text-foreground">
          AI 工具榜
        </Link>
        {category && (
          <>
            {" / "}
            <Link
              href={`/tools?category=${category.slug}`}
              className="hover:text-foreground"
            >
              {category.name}
            </Link>
          </>
        )}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Logo placeholder */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl font-bold text-primary">
            {tool.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{tool.name}</h1>
              {tool.verified && (
                <span className="text-primary" title="已认证">
                  ✓
                </span>
              )}
            </div>
            {tool.description && (
              <p className="mt-1 text-muted-foreground">{tool.description}</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline">{tool.pricing_model}</Badge>
              {tool.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <BookmarkButton
            toolId={tool.id}
            initialBookmarked={isBookmarked}
            userId={user?.id ?? null}
          />
          <a href={tool.url} target="_blank" rel="noopener noreferrer">
            <Button>访问官网 →</Button>
          </a>
        </div>
      </div>

      {/* Stats cards */}
      {latestRanking && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card className="border-border bg-card p-4 text-center">
            <div className="text-sm text-muted-foreground">当前排名</div>
            <div className="mt-1 text-2xl font-bold">
              #{latestRanking.rank ?? "—"}
            </div>
          </Card>
          <Card className="border-border bg-card p-4 text-center">
            <div className="text-sm text-muted-foreground">月访问量</div>
            <div className="mt-1 text-2xl font-bold">
              {formatVisits(latestRanking.monthly_visits)}
            </div>
          </Card>
          <Card className="border-border bg-card p-4 text-center">
            <div className="text-sm text-muted-foreground">增长率</div>
            <div
              className={`mt-1 text-2xl font-bold ${
                latestRanking.growth_rate > 0
                  ? "text-green-500"
                  : latestRanking.growth_rate < 0
                    ? "text-red-500"
                    : ""
              }`}
            >
              {latestRanking.growth_rate > 0 ? "+" : ""}
              {latestRanking.growth_rate}%
            </div>
          </Card>
        </div>
      )}

      {/* Rankings history */}
      {rankings && rankings.length > 1 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">排名趋势</h2>
          <Card className="border-border bg-card p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4">期间</th>
                    <th className="pb-2 pr-4">排名</th>
                    <th className="pb-2 pr-4">月访问量</th>
                    <th className="pb-2">增长率</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-2 pr-4">{r.period}</td>
                      <td className="py-2 pr-4">#{r.rank ?? "—"}</td>
                      <td className="py-2 pr-4">
                        {formatVisits(r.monthly_visits)}
                      </td>
                      <td
                        className={`py-2 ${
                          r.growth_rate > 0
                            ? "text-green-500"
                            : r.growth_rate < 0
                              ? "text-red-500"
                              : ""
                        }`}
                      >
                        {r.growth_rate > 0 ? "+" : ""}
                        {r.growth_rate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 创建目录结构**

```bash
mkdir -p src/app/tools/\[slug\]
```

- [ ] **Step 3: 提交**

```bash
git add src/app/tools/
git commit -m "feat: add tool detail page with rankings history and bookmark"
```

---

## Task 9: 端到端验证 + 最终提交

**Files:**
- No new files

- [ ] **Step 1: 运行所有测试**

```bash
npx vitest run
```

Expected: 所有测试通过（navbar, category-sidebar, tutorial-card, tool-card, tool-category-filter, ranking-tabs）

- [ ] **Step 2: 构建检查**

```bash
npx next build
```

Expected: 构建成功，新增路由 `/tools` 和 `/tools/[slug]`

- [ ] **Step 3: 验证路由输出**

构建输出中应包含：

```
Route (app)
├ ○ /
├ ○ /login
├ ○ /signup
├ ƒ /tools
├ ƒ /tools/[slug]
├ ƒ /tutorials
├ ƒ /tutorials/[category]
└ ƒ /tutorials/[category]/[slug]
```

- [ ] **Step 4: 提交最终验证**

如果有任何类型修复或构建修复，提交：

```bash
git add -A
git commit -m "fix: resolve build issues for AI tools ranking module"
```
