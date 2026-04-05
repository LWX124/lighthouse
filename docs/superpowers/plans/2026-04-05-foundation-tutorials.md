# Plan 1: 项目基础架构 + 教程板块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Lighthouse 平台的 Next.js 前端基础架构，集成 Supabase（数据库 + 认证），实现教程板块的完整 CRUD 和展示功能。

**Architecture:** Next.js 15 App Router 前端部署在 Vercel，Supabase 提供 PostgreSQL 数据库和认证服务。教程内容使用 MDX 格式存储在数据库中，通过 SSG/ISR 渲染。树形分类系统支持无限嵌套。

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Supabase (PostgreSQL + Auth), MDX, Vitest

**Spec Reference:** `docs/superpowers/specs/2026-04-05-lighthouse-design.md`

---

## File Structure

```
lighthouse/
├── .env.local                          # Supabase keys (gitignored)
├── .env.example                        # Template for env vars
├── next.config.ts                      # Next.js configuration
├── tailwind.config.ts                  # Tailwind configuration
├── tsconfig.json                       # TypeScript configuration
├── vitest.config.ts                    # Test configuration
├── package.json
├── supabase/
│   └── migrations/
│       ├── 001_profiles.sql            # profiles + subscriptions + user_usage
│       └── 002_tutorials.sql           # categories + tutorials + tutorial_progress
├── src/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts               # Browser Supabase client
│   │   │   ├── server.ts               # Server Supabase client (cookies)
│   │   │   ├── middleware.ts            # Auth middleware helper
│   │   │   └── types.ts                # Generated DB types
│   │   └── utils.ts                    # Shared utilities (cn, etc.)
│   ├── app/
│   │   ├── layout.tsx                  # Root layout (fonts, theme, providers)
│   │   ├── page.tsx                    # Homepage (placeholder for now)
│   │   ├── globals.css                 # Tailwind imports + custom vars
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx          # Login page
│   │   │   ├── signup/page.tsx         # Signup page
│   │   │   └── callback/route.ts       # OAuth callback handler
│   │   └── tutorials/
│   │       ├── page.tsx                # Tutorial index (all categories)
│   │       └── [category]/
│   │           ├── page.tsx            # Category page (tutorial list)
│   │           └── [slug]/page.tsx     # Individual tutorial page (MDX)
│   ├── components/
│   │   ├── ui/                         # shadcn/ui components (auto-generated)
│   │   ├── layout/
│   │   │   ├── navbar.tsx              # Top navigation bar
│   │   │   └── footer.tsx              # Footer
│   │   └── tutorials/
│   │       ├── category-sidebar.tsx    # Tree navigation sidebar
│   │       ├── tutorial-card.tsx       # Tutorial preview card
│   │       └── mdx-renderer.tsx        # MDX content renderer
│   └── middleware.ts                   # Next.js middleware (auth session refresh)
├── tests/
│   ├── lib/
│   │   └── supabase/
│   │       └── types.test.ts           # Type sanity checks
│   └── components/
│       └── tutorials/
│           ├── category-sidebar.test.tsx
│           └── tutorial-card.test.tsx
└── docs/
    └── feature_setup.md
```

---

## Task 1: Next.js 项目初始化

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/lib/utils.ts`, `.env.example`, `.gitignore`

- [ ] **Step 1: 初始化 Next.js 项目**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --no-turbopack
```

Expected: 项目文件生成，`pnpm dev` 可启动

- [ ] **Step 2: 安装核心依赖**

```bash
pnpm add @supabase/supabase-js @supabase/ssr clsx tailwind-merge lucide-react
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @types/node
```

- [ ] **Step 3: 配置 vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Create `tests/setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: 配置 utils**

Create `src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5: 创建 .env.example**

Create `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Update `.gitignore` to include:
```
.env.local
.env*.local
.superpowers/
```

- [ ] **Step 6: 配置深色主题的 globals.css**

Replace `src/app/globals.css`:

```css
@import "tailwindcss";

:root {
  --background: #0f0f17;
  --foreground: #e5e5ea;
  --card: #1a1a21;
  --card-border: #2d2d38;
  --primary: #616bfa;
  --primary-foreground: #ffffff;
  --muted: #8e8e99;
  --accent: #f4845f;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: "Inter", system-ui, sans-serif;
}
```

- [ ] **Step 7: 配置根 layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lighthouse — AI 驱动的一站式信息平台",
  description: "发现 AI 工具，捕捉需求，从想法到落地",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: 验证项目启动**

```bash
pnpm dev
```

Expected: 浏览器打开 http://localhost:3000 看到默认页面，无报错

- [ ] **Step 9: 提交**

```bash
git add -A
git commit -m "feat: initialize Next.js project with Tailwind, Vitest, dark theme"
```

---

## Task 2: 安装 shadcn/ui 基础组件

**Files:**
- Create: `components.json`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/card.tsx`, `src/components/ui/separator.tsx`, `src/components/ui/scroll-area.tsx`

- [ ] **Step 1: 初始化 shadcn/ui**

```bash
pnpm dlx shadcn@latest init
```

选择: New York style, Zinc color, CSS variables: yes

- [ ] **Step 2: 安装需要的组件**

```bash
pnpm dlx shadcn@latest add button input badge card separator scroll-area avatar dropdown-menu
```

- [ ] **Step 3: 验证组件可用**

在 `src/app/page.tsx` 中临时导入 Button 验证:

```tsx
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Button>Lighthouse</Button>
    </main>
  );
}
```

```bash
pnpm dev
```

Expected: 页面显示一个按钮，无报错

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: add shadcn/ui components (button, input, badge, card, etc.)"
```

---

## Task 3: Supabase 客户端配置

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`, `src/middleware.ts`

- [ ] **Step 1: 创建浏览器端 Supabase 客户端**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: 创建服务端 Supabase 客户端**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — ignore
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: 创建 middleware helper**

Create `src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}
```

- [ ] **Step 4: 创建 Next.js middleware**

Create `src/middleware.ts`:

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 5: 提交**

```bash
git add src/lib/supabase/ src/middleware.ts
git commit -m "feat: configure Supabase client (browser + server + middleware)"
```

---

## Task 4: 数据库迁移 — 用户体系

**Files:**
- Create: `supabase/migrations/001_profiles.sql`

- [ ] **Step 1: 创建用户体系迁移文件**

Create `supabase/migrations/001_profiles.sql`:

```sql
-- Profiles (extends Supabase Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  role text default 'user' check (role in ('user', 'admin')),
  preferences jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Subscriptions
create table public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  plan text default 'free' check (plan in ('free', 'pro')),
  status text default 'active' check (status in ('active', 'canceled', 'past_due')),
  stripe_sub_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select using (auth.uid() = user_id);

-- Auto-create free subscription on profile creation
create or replace function public.handle_new_profile()
returns trigger as $$
begin
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();

-- Daily usage tracking
create table public.user_usage (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date default current_date not null,
  ai_requests integer default 0,
  plan_generations integer default 0,
  tool_searches integer default 0,
  unique(user_id, date)
);

alter table public.user_usage enable row level security;

create policy "Users can view own usage"
  on public.user_usage for select using (auth.uid() = user_id);

create policy "Users can insert own usage"
  on public.user_usage for insert with check (auth.uid() = user_id);

create policy "Users can update own usage"
  on public.user_usage for update using (auth.uid() = user_id);
```

- [ ] **Step 2: 在 Supabase Dashboard 中执行迁移**

打开 Supabase Dashboard → SQL Editor → 粘贴并执行 `001_profiles.sql`

Expected: 三张表创建成功（profiles, subscriptions, user_usage），两个 trigger 创建成功

- [ ] **Step 3: 提交**

```bash
git add supabase/
git commit -m "feat: add user system migrations (profiles, subscriptions, usage)"
```

---

## Task 5: 数据库迁移 — 教程板块

**Files:**
- Create: `supabase/migrations/002_tutorials.sql`

- [ ] **Step 1: 创建教程板块迁移文件**

Create `supabase/migrations/002_tutorials.sql`:

```sql
-- Tutorial categories (tree structure)
create table public.categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  parent_id uuid references public.categories(id) on delete set null,
  "order" integer default 0,
  created_at timestamptz default now()
);

alter table public.categories enable row level security;

create policy "Categories are viewable by everyone"
  on public.categories for select using (true);

create index idx_categories_parent on public.categories(parent_id);
create index idx_categories_slug on public.categories(slug);

-- Tutorials
create table public.tutorials (
  id uuid default gen_random_uuid() primary key,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  content text not null default '',
  summary text,
  "order" integer default 0,
  is_free boolean default true,
  status text default 'draft' check (status in ('draft', 'published')),
  read_time_minutes integer default 5,
  view_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tutorials enable row level security;

create policy "Published tutorials are viewable by everyone"
  on public.tutorials for select using (status = 'published');

create policy "Admins can manage tutorials"
  on public.tutorials for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create index idx_tutorials_category on public.tutorials(category_id);
create index idx_tutorials_slug on public.tutorials(slug);
create index idx_tutorials_status on public.tutorials(status);

-- Tutorial progress tracking
create table public.tutorial_progress (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  tutorial_id uuid references public.tutorials(id) on delete cascade not null,
  progress_pct integer default 0 check (progress_pct between 0 and 100),
  completed_at timestamptz,
  updated_at timestamptz default now(),
  unique(user_id, tutorial_id)
);

alter table public.tutorial_progress enable row level security;

create policy "Users can view own progress"
  on public.tutorial_progress for select using (auth.uid() = user_id);

create policy "Users can upsert own progress"
  on public.tutorial_progress for insert with check (auth.uid() = user_id);

create policy "Users can update own progress"
  on public.tutorial_progress for update using (auth.uid() = user_id);

-- Seed data: initial categories
insert into public.categories (name, slug, description, icon, "order") values
  ('AI出海教程', 'ai-overseas', '面向海外市场的 AI 产品开发和运营指南', '🌏', 1),
  ('OpenClaw 教程', 'openclaw', 'OpenClaw 平台使用和开发教程', '🦞', 2),
  ('小红书矩阵营销', 'xiaohongshu-matrix', '小红书账号矩阵运营和 AI 辅助营销', '📱', 3),
  ('AI漫剧制作', 'ai-comic', 'AI 驱动的漫画和短剧制作教程', '🎬', 4);

-- Seed data: sample tutorial
insert into public.tutorials (category_id, title, slug, content, summary, is_free, status, read_time_minutes)
select
  id,
  'AI出海第一步：市场调研方法',
  'ai-overseas-market-research',
  '## 为什么要做市场调研？

在开始开发 AI 产品之前，了解目标市场是至关重要的第一步。

### 1. 确定目标市场

首先需要明确你的产品面向哪个地区和人群：

- **北美市场**：付费意愿强，竞争激烈
- **东南亚市场**：增长快，价格敏感
- **欧洲市场**：注重隐私合规（GDPR）

### 2. 竞品分析工具

推荐使用以下工具进行竞品分析：

- SimilarWeb：流量和用户行为分析
- Toolify.ai：AI 工具排名和趋势
- Product Hunt：新产品发现和验证

### 3. 需求验证方法

通过以下渠道验证你的产品需求：

1. Reddit 相关 subreddit 的讨论
2. HackerNews 上的 Show HN 帖子反馈
3. Twitter/X 上的用户痛点表达',
  '学习如何通过系统化的市场调研方法，为你的 AI 出海产品找到最佳切入点',
  true,
  'published',
  15
from public.categories
where slug = 'ai-overseas';
```

- [ ] **Step 2: 在 Supabase Dashboard 中执行迁移**

打开 Supabase Dashboard → SQL Editor → 粘贴并执行 `002_tutorials.sql`

Expected: 三张表创建成功（categories, tutorials, tutorial_progress），4 个分类和 1 个示例教程插入成功

- [ ] **Step 3: 提交**

```bash
git add supabase/
git commit -m "feat: add tutorial migrations (categories, tutorials, progress) with seed data"
```

---

## Task 6: 生成 Supabase 类型 + 配置 .env.local

**Files:**
- Create: `src/lib/supabase/types.ts`
- Modify: `.env.local`

- [ ] **Step 1: 配置 .env.local**

从 Supabase Dashboard → Settings → API 获取 URL 和 anon key，创建 `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 2: 生成数据库类型**

```bash
pnpm add -D supabase
pnpm supabase gen types typescript --project-id your-project-id > src/lib/supabase/types.ts
```

如果 CLI 不可用，手动创建 `src/lib/supabase/types.ts`:

```typescript
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          role: "user" | "admin";
          preferences: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: "free" | "pro";
          status: "active" | "canceled" | "past_due";
          stripe_sub_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["subscriptions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
      };
      categories: {
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
        Insert: Omit<Database["public"]["Tables"]["categories"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
      };
      tutorials: {
        Row: {
          id: string;
          category_id: string | null;
          title: string;
          slug: string;
          content: string;
          summary: string | null;
          order: number;
          is_free: boolean;
          status: "draft" | "published";
          read_time_minutes: number;
          view_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["tutorials"]["Row"], "id" | "created_at" | "updated_at" | "view_count">;
        Update: Partial<Database["public"]["Tables"]["tutorials"]["Insert"]>;
      };
      tutorial_progress: {
        Row: {
          id: string;
          user_id: string;
          tutorial_id: string;
          progress_pct: number;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["tutorial_progress"]["Row"], "id" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["tutorial_progress"]["Insert"]>;
      };
      user_usage: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          ai_requests: number;
          plan_generations: number;
          tool_searches: number;
        };
        Insert: Omit<Database["public"]["Tables"]["user_usage"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["user_usage"]["Insert"]>;
      };
    };
  };
};
```

- [ ] **Step 3: 更新 Supabase 客户端使用类型**

Modify `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

Modify `src/lib/supabase/server.ts` — add `<Database>` generic to `createServerClient<Database>(...)`.

- [ ] **Step 4: 提交**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase database types and typed clients"
```

---

## Task 7: 导航栏 + Footer 组件

**Files:**
- Create: `src/components/layout/navbar.tsx`, `src/components/layout/footer.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: 编写 navbar 测试**

Create `tests/components/layout/navbar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Navbar } from "@/components/layout/navbar";

describe("Navbar", () => {
  it("renders logo text", () => {
    render(<Navbar />);
    expect(screen.getByText("Lighthouse")).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    render(<Navbar />);
    expect(screen.getByText("教程")).toBeInTheDocument();
    expect(screen.getByText("AI工具榜")).toBeInTheDocument();
    expect(screen.getByText("AI新鲜事")).toBeInTheDocument();
    expect(screen.getByText("需求Hub")).toBeInTheDocument();
    expect(screen.getByText("AI实践")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm vitest run tests/components/layout/navbar.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: 实现 Navbar 组件**

Create `src/components/layout/navbar.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/tutorials", label: "教程" },
  { href: "/tools", label: "AI工具榜" },
  { href: "/news", label: "AI新鲜事" },
  { href: "/demands", label: "需求Hub" },
  { href: "/practice", label: "AI实践" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--card-border)] bg-[var(--background)]/80 backdrop-blur-sm">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-[var(--primary)]">
          Lighthouse
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              登录
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">注册</Button>
          </Link>
        </div>
      </nav>
    </header>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm vitest run tests/components/layout/navbar.test.tsx
```

Expected: PASS

- [ ] **Step 5: 实现 Footer 组件**

Create `src/components/layout/footer.tsx`:

```tsx
import Link from "next/link";

const footerLinks = [
  {
    title: "产品",
    links: [
      { href: "/tutorials", label: "教程" },
      { href: "/tools", label: "AI工具榜" },
      { href: "/news", label: "AI新鲜事" },
      { href: "/demands", label: "需求Hub" },
      { href: "/practice", label: "AI实践" },
    ],
  },
  {
    title: "支持",
    links: [
      { href: "/pricing", label: "定价" },
      { href: "/about", label: "关于我们" },
      { href: "/contact", label: "联系我们" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--card-border)] bg-[var(--background)]">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
          <div>
            <h3 className="text-lg font-bold text-[var(--primary)]">Lighthouse</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              AI 驱动的一站式信息平台
            </p>
          </div>
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h4 className="font-semibold">{group.title}</h4>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 border-t border-[var(--card-border)] pt-8 text-center text-sm text-[var(--muted)]">
          © {new Date().getFullYear()} Lighthouse. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 6: 集成到根 layout**

Modify `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lighthouse — AI 驱动的一站式信息平台",
  description: "发现 AI 工具，捕捉需求，从想法到落地",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={inter.className}>
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

- [ ] **Step 7: 验证页面渲染**

```bash
pnpm dev
```

Expected: 页面顶部显示导航栏，底部显示 Footer，中间为内容区

- [ ] **Step 8: 提交**

```bash
git add src/components/layout/ src/app/layout.tsx tests/components/layout/
git commit -m "feat: add Navbar and Footer layout components"
```

---

## Task 8: 认证页面（登录 / 注册 / OAuth 回调）

**Files:**
- Create: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/callback/route.ts`

- [ ] **Step 1: 创建 OAuth 回调处理**

Create `src/app/(auth)/callback/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

- [ ] **Step 2: 创建登录页面**

Create `src/app/(auth)/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleGithubLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/callback` },
    });
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">登录 Lighthouse</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            继续探索 AI 世界
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[var(--card-border)]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[var(--background)] px-2 text-[var(--muted)]">
              或
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleGithubLogin}
        >
          使用 GitHub 登录
        </Button>

        <p className="text-center text-sm text-[var(--muted)]">
          还没有账号？{" "}
          <Link href="/signup" className="text-[var(--primary)] hover:underline">
            注册
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建注册页面**

Create `src/app/(auth)/signup/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">验证邮件已发送</h1>
          <p className="text-[var(--muted)]">
            请检查你的邮箱 {email}，点击验证链接完成注册。
          </p>
          <Link href="/login">
            <Button variant="outline">返回登录</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">注册 Lighthouse</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            开始你的 AI 探索之旅
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <Input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="密码（至少 6 位）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "注册中..." : "注册"}
          </Button>
        </form>

        <p className="text-center text-sm text-[var(--muted)]">
          已有账号？{" "}
          <Link href="/login" className="text-[var(--primary)] hover:underline">
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 验证页面渲染**

```bash
pnpm dev
```

Expected: 访问 /login 和 /signup 显示对应表单，点击导航栏"登录"/"注册"可跳转

- [ ] **Step 5: 提交**

```bash
git add src/app/\(auth\)/
git commit -m "feat: add login, signup pages and OAuth callback handler"
```

---

## Task 9: 教程分类侧边栏组件

**Files:**
- Create: `src/components/tutorials/category-sidebar.tsx`, `tests/components/tutorials/category-sidebar.test.tsx`

- [ ] **Step 1: 编写侧边栏测试**

Create `tests/components/tutorials/category-sidebar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CategorySidebar } from "@/components/tutorials/category-sidebar";

const mockCategories = [
  {
    id: "1",
    name: "AI出海教程",
    slug: "ai-overseas",
    description: null,
    icon: "🌏",
    parent_id: null,
    order: 1,
    created_at: "",
  },
  {
    id: "2",
    name: "OpenClaw 教程",
    slug: "openclaw",
    description: null,
    icon: "🦞",
    parent_id: null,
    order: 2,
    created_at: "",
  },
];

describe("CategorySidebar", () => {
  it("renders category names", () => {
    render(<CategorySidebar categories={mockCategories} />);
    expect(screen.getByText("AI出海教程")).toBeInTheDocument();
    expect(screen.getByText("OpenClaw 教程")).toBeInTheDocument();
  });

  it("renders category icons", () => {
    render(<CategorySidebar categories={mockCategories} />);
    expect(screen.getByText("🌏")).toBeInTheDocument();
    expect(screen.getByText("🦞")).toBeInTheDocument();
  });

  it("highlights active category", () => {
    render(
      <CategorySidebar categories={mockCategories} activeSlug="ai-overseas" />
    );
    const activeLink = screen.getByText("AI出海教程").closest("a");
    expect(activeLink).toHaveClass("text-[var(--primary)]");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm vitest run tests/components/tutorials/category-sidebar.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: 实现侧边栏组件**

Create `src/components/tutorials/category-sidebar.tsx`:

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Database } from "@/lib/supabase/types";

type Category = Database["public"]["Tables"]["categories"]["Row"];

interface CategorySidebarProps {
  categories: Category[];
  activeSlug?: string;
}

function buildTree(categories: Category[]): (Category & { children: Category[] })[] {
  const map = new Map<string | null, Category[]>();
  for (const cat of categories) {
    const parentId = cat.parent_id;
    if (!map.has(parentId)) map.set(parentId, []);
    map.get(parentId)!.push(cat);
  }

  function getChildren(parentId: string | null): (Category & { children: Category[] })[] {
    return (map.get(parentId) ?? [])
      .sort((a, b) => a.order - b.order)
      .map((cat) => ({ ...cat, children: getChildren(cat.id) }));
  }

  return getChildren(null);
}

export function CategorySidebar({ categories, activeSlug }: CategorySidebarProps) {
  const tree = buildTree(categories);

  return (
    <aside className="w-64 shrink-0 border-r border-[var(--card-border)]">
      <ScrollArea className="h-[calc(100vh-4rem)]">
        <div className="p-4">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            教程分类
          </h2>
          <nav className="space-y-1">
            {tree.map((cat) => (
              <CategoryItem
                key={cat.id}
                category={cat}
                activeSlug={activeSlug}
                depth={0}
              />
            ))}
          </nav>
        </div>
      </ScrollArea>
    </aside>
  );
}

function CategoryItem({
  category,
  activeSlug,
  depth,
}: {
  category: Category & { children: (Category & { children: Category[] })[] };
  activeSlug?: string;
  depth: number;
}) {
  const isActive = category.slug === activeSlug;

  return (
    <div>
      <Link
        href={`/tutorials/${category.slug}`}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[var(--card)]",
          isActive
            ? "text-[var(--primary)] font-medium bg-[var(--card)]"
            : "text-[var(--muted)]"
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {category.icon && <span>{category.icon}</span>}
        <span>{category.name}</span>
      </Link>
      {category.children.length > 0 && (
        <div>
          {category.children.map((child) => (
            <CategoryItem
              key={child.id}
              category={child}
              activeSlug={activeSlug}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm vitest run tests/components/tutorials/category-sidebar.test.tsx
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/tutorials/category-sidebar.tsx tests/components/tutorials/
git commit -m "feat: add tutorial category sidebar with tree navigation"
```

---

## Task 10: 教程卡片 + MDX 渲染器

**Files:**
- Create: `src/components/tutorials/tutorial-card.tsx`, `src/components/tutorials/mdx-renderer.tsx`, `tests/components/tutorials/tutorial-card.test.tsx`

- [ ] **Step 1: 安装 MDX 依赖**

```bash
pnpm add next-mdx-remote
```

- [ ] **Step 2: 编写教程卡片测试**

Create `tests/components/tutorials/tutorial-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TutorialCard } from "@/components/tutorials/tutorial-card";

const mockTutorial = {
  id: "1",
  category_id: "cat-1",
  title: "AI出海第一步：市场调研方法",
  slug: "ai-overseas-market-research",
  content: "",
  summary: "学习如何通过系统化的市场调研方法找到最佳切入点",
  order: 1,
  is_free: true,
  status: "published" as const,
  read_time_minutes: 15,
  view_count: 1200,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

describe("TutorialCard", () => {
  it("renders tutorial title", () => {
    render(<TutorialCard tutorial={mockTutorial} categorySlug="ai-overseas" />);
    expect(screen.getByText("AI出海第一步：市场调研方法")).toBeInTheDocument();
  });

  it("renders summary", () => {
    render(<TutorialCard tutorial={mockTutorial} categorySlug="ai-overseas" />);
    expect(screen.getByText(/系统化的市场调研/)).toBeInTheDocument();
  });

  it("renders read time", () => {
    render(<TutorialCard tutorial={mockTutorial} categorySlug="ai-overseas" />);
    expect(screen.getByText(/15 分钟/)).toBeInTheDocument();
  });

  it("shows free badge for free tutorials", () => {
    render(<TutorialCard tutorial={mockTutorial} categorySlug="ai-overseas" />);
    expect(screen.getByText("免费")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

```bash
pnpm vitest run tests/components/tutorials/tutorial-card.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 4: 实现教程卡片组件**

Create `src/components/tutorials/tutorial-card.tsx`:

```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/types";

type Tutorial = Database["public"]["Tables"]["tutorials"]["Row"];

interface TutorialCardProps {
  tutorial: Tutorial;
  categorySlug: string;
}

export function TutorialCard({ tutorial, categorySlug }: TutorialCardProps) {
  return (
    <Link href={`/tutorials/${categorySlug}/${tutorial.slug}`}>
      <Card className="border-[var(--card-border)] bg-[var(--card)] p-5 transition-colors hover:border-[var(--primary)]/50">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <h3 className="font-semibold leading-tight">{tutorial.title}</h3>
            {tutorial.summary && (
              <p className="text-sm text-[var(--muted)] line-clamp-2">
                {tutorial.summary}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
              <span>🕐 {tutorial.read_time_minutes} 分钟</span>
              <span>👁 {tutorial.view_count.toLocaleString()} 浏览</span>
            </div>
          </div>
          {tutorial.is_free && (
            <Badge variant="secondary" className="shrink-0">
              免费
            </Badge>
          )}
        </div>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
pnpm vitest run tests/components/tutorials/tutorial-card.test.tsx
```

Expected: PASS

- [ ] **Step 6: 实现 MDX 渲染器**

Create `src/components/tutorials/mdx-renderer.tsx`:

```tsx
import { MDXRemote } from "next-mdx-remote/rsc";

const mdxComponents = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="mt-8 mb-4 text-3xl font-bold" {...props} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mt-6 mb-3 text-2xl font-semibold" {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mt-4 mb-2 text-xl font-semibold" {...props} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mb-4 leading-relaxed text-[var(--foreground)]" {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="mb-4 ml-6 list-disc space-y-1" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="mb-4 ml-6 list-decimal space-y-1" {...props} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="leading-relaxed" {...props} />
  ),
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code
      className="rounded bg-[var(--card)] px-1.5 py-0.5 text-sm font-mono text-[var(--primary)]"
      {...props}
    />
  ),
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="mb-4 overflow-x-auto rounded-lg bg-[var(--card)] p-4 text-sm"
      {...props}
    />
  ),
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-[var(--foreground)]" {...props} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className="text-[var(--primary)] underline underline-offset-4 hover:text-[var(--primary)]/80"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
};

interface MdxRendererProps {
  content: string;
}

export function MdxRenderer({ content }: MdxRendererProps) {
  return (
    <article className="prose-invert max-w-none">
      <MDXRemote source={content} components={mdxComponents} />
    </article>
  );
}
```

- [ ] **Step 7: 提交**

```bash
git add src/components/tutorials/ tests/components/tutorials/
git commit -m "feat: add tutorial card and MDX renderer components"
```

---

## Task 11: 教程页面（索引页 + 分类页 + 详情页）

**Files:**
- Create: `src/app/tutorials/page.tsx`, `src/app/tutorials/[category]/page.tsx`, `src/app/tutorials/[category]/[slug]/page.tsx`

- [ ] **Step 1: 创建教程索引页**

Create `src/app/tutorials/page.tsx`:

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

export const revalidate = 3600; // ISR: 1 hour

export default async function TutorialsPage() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .is("parent_id", null)
    .order("order");

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">教程</h1>
        <p className="mt-2 text-[var(--muted)]">
          系统化学习 AI 工具和实践方法
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories?.map((cat) => (
          <Link key={cat.id} href={`/tutorials/${cat.slug}`}>
            <Card className="border-[var(--card-border)] bg-[var(--card)] p-6 transition-colors hover:border-[var(--primary)]/50">
              <div className="mb-3 text-3xl">{cat.icon}</div>
              <h2 className="text-lg font-semibold">{cat.name}</h2>
              {cat.description && (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {cat.description}
                </p>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建分类页面**

Create `src/app/tutorials/[category]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CategorySidebar } from "@/components/tutorials/category-sidebar";
import { TutorialCard } from "@/components/tutorials/tutorial-card";

export const revalidate = 3600;

interface Props {
  params: Promise<{ category: string }>;
}

export default async function CategoryPage({ params }: Props) {
  const { category: categorySlug } = await params;
  const supabase = await createClient();

  const [{ data: categories }, { data: currentCategory }] = await Promise.all([
    supabase.from("categories").select("*").order("order"),
    supabase
      .from("categories")
      .select("*")
      .eq("slug", categorySlug)
      .single(),
  ]);

  if (!currentCategory) notFound();

  const { data: tutorials } = await supabase
    .from("tutorials")
    .select("*")
    .eq("category_id", currentCategory.id)
    .eq("status", "published")
    .order("order");

  return (
    <div className="flex">
      <CategorySidebar
        categories={categories ?? []}
        activeSlug={categorySlug}
      />
      <div className="flex-1 px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            {currentCategory.icon} {currentCategory.name}
          </h1>
          {currentCategory.description && (
            <p className="mt-2 text-[var(--muted)]">
              {currentCategory.description}
            </p>
          )}
        </div>

        <div className="space-y-4">
          {tutorials?.map((tutorial) => (
            <TutorialCard
              key={tutorial.id}
              tutorial={tutorial}
              categorySlug={categorySlug}
            />
          ))}
          {(!tutorials || tutorials.length === 0) && (
            <p className="text-[var(--muted)]">该分类暂无教程</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建教程详情页**

Create `src/app/tutorials/[category]/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CategorySidebar } from "@/components/tutorials/category-sidebar";
import { MdxRenderer } from "@/components/tutorials/mdx-renderer";
import { Badge } from "@/components/ui/badge";

export const revalidate = 3600;

interface Props {
  params: Promise<{ category: string; slug: string }>;
}

export default async function TutorialPage({ params }: Props) {
  const { category: categorySlug, slug } = await params;
  const supabase = await createClient();

  const [{ data: categories }, { data: tutorial }] = await Promise.all([
    supabase.from("categories").select("*").order("order"),
    supabase.from("tutorials").select("*").eq("slug", slug).single(),
  ]);

  if (!tutorial) notFound();

  // Get prev/next tutorials in same category
  const { data: siblings } = await supabase
    .from("tutorials")
    .select("title, slug, order")
    .eq("category_id", tutorial.category_id!)
    .eq("status", "published")
    .order("order");

  const currentIndex = siblings?.findIndex((t) => t.slug === slug) ?? -1;
  const prev = currentIndex > 0 ? siblings![currentIndex - 1] : null;
  const next =
    siblings && currentIndex < siblings.length - 1
      ? siblings[currentIndex + 1]
      : null;

  return (
    <div className="flex">
      <CategorySidebar
        categories={categories ?? []}
        activeSlug={categorySlug}
      />
      <div className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-3xl">
          {/* Breadcrumb */}
          <div className="mb-4 text-sm text-[var(--muted)]">
            <Link
              href="/tutorials"
              className="hover:text-[var(--foreground)]"
            >
              教程
            </Link>
            {" / "}
            <Link
              href={`/tutorials/${categorySlug}`}
              className="hover:text-[var(--foreground)]"
            >
              {categories?.find((c) => c.slug === categorySlug)?.name}
            </Link>
          </div>

          {/* Header */}
          <h1 className="text-3xl font-bold">{tutorial.title}</h1>
          <div className="mt-3 flex items-center gap-4 text-sm text-[var(--muted)]">
            <span>🕐 {tutorial.read_time_minutes} 分钟</span>
            <span>👁 {tutorial.view_count.toLocaleString()} 浏览</span>
            {tutorial.is_free && <Badge variant="secondary">免费</Badge>}
          </div>

          {/* Content */}
          <div className="mt-8">
            <MdxRenderer content={tutorial.content} />
          </div>

          {/* Prev/Next navigation */}
          <div className="mt-12 flex justify-between border-t border-[var(--card-border)] pt-6">
            {prev ? (
              <Link
                href={`/tutorials/${categorySlug}/${prev.slug}`}
                className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                ← {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/tutorials/${categorySlug}/${next.slug}`}
                className="text-sm text-[var(--primary)] hover:underline"
              >
                {next.title} →
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 验证页面渲染**

```bash
pnpm dev
```

Expected:
- `/tutorials` — 显示分类卡片网格
- `/tutorials/ai-overseas` — 左侧分类导航 + 右侧教程列表
- `/tutorials/ai-overseas/ai-overseas-market-research` — 左侧导航 + 右侧 MDX 内容 + 上下篇导航

- [ ] **Step 5: 提交**

```bash
git add src/app/tutorials/
git commit -m "feat: add tutorial pages (index, category, detail with MDX rendering)"
```

---

## Task 12: 首页占位 + 全局样式收尾

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 创建首页占位内容**

Replace `src/app/page.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-5xl font-bold leading-tight">
          AI 驱动的
          <br />
          <span className="text-[var(--primary)]">一站式信息平台</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-[var(--muted)]">
          发现最新 AI 工具，捕捉市场需求，从想法到落地方案，Lighthouse 帮你照亮前路。
        </p>
        <div className="mt-8 flex gap-4">
          <Link href="/tutorials">
            <Button size="lg">开始学习</Button>
          </Link>
          <Link href="/tools">
            <Button size="lg" variant="outline">
              探索工具
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature cards placeholder */}
      <section className="grid gap-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { icon: "📚", title: "教程", desc: "系统化 AI 实践教程" },
          { icon: "🏆", title: "AI工具榜", desc: "发现最佳 AI 工具" },
          { icon: "📰", title: "AI新鲜事", desc: "多源 AI 资讯聚合" },
          { icon: "💡", title: "需求Hub", desc: "捕捉高价值需求信号" },
          { icon: "🚀", title: "AI实践", desc: "从想法到落地方案" },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6"
          >
            <div className="mb-3 text-3xl">{item.icon}</div>
            <h3 className="font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{item.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: 验证首页渲染**

```bash
pnpm dev
```

Expected: 首页显示 Hero 区域 + 5 个功能卡片，导航栏和 Footer 正常显示

- [ ] **Step 3: 提交**

```bash
git add src/app/page.tsx
git commit -m "feat: add homepage with hero section and feature cards"
```

---

## Task 13: 端到端验证 + 最终提交

**Files:**
- No new files

- [ ] **Step 1: 运行所有测试**

```bash
pnpm vitest run
```

Expected: 所有测试通过（navbar, category-sidebar, tutorial-card）

- [ ] **Step 2: 构建检查**

```bash
pnpm build
```

Expected: 构建成功，无 TypeScript 错误。如果 Supabase 环境变量未配置，构建时可能报错 — 这是预期行为，配置 `.env.local` 后即可解决。

- [ ] **Step 3: 手动验证页面**

启动开发服务器，逐一检查：

1. `http://localhost:3000` — 首页 Hero + 功能卡片
2. `http://localhost:3000/tutorials` — 教程分类网格
3. `http://localhost:3000/tutorials/ai-overseas` — 侧边栏 + 教程列表
4. `http://localhost:3000/tutorials/ai-overseas/ai-overseas-market-research` — MDX 内容渲染
5. `http://localhost:3000/login` — 登录表单
6. `http://localhost:3000/signup` — 注册表单
7. 导航栏链接跳转正常
8. Footer 链接正常

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: complete Plan 1 - foundation architecture + tutorial module"
```
