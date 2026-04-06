# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/admin` panel with route-level access control, content moderation for news and demand signals, and tutorial management with a Markdown editor.

**Architecture:** All admin functionality lives inside the existing Next.js project under `src/app/admin/`. Middleware guards all `/admin/*` routes by checking `profiles.role = 'admin'`. Content moderation adds a `status` column to `news_items` and a `pending` value to `demand_signals.status`. Tutorial management reuses the existing `tutorials` and `categories` tables.

**Tech Stack:** Next.js 16 App Router, Supabase (SSR client + service role), shadcn/ui, `@uiw/react-md-editor`, Vitest + @testing-library/react

---

## File Map

**New files:**
- `supabase/migrations/006_admin_moderation.sql` — DB migration: add status to news_items, add pending to demand_signals
- `src/middleware.ts` — extend to guard `/admin/*`
- `src/app/admin/layout.tsx` — admin sidebar layout
- `src/app/admin/page.tsx` — redirect to /admin/news
- `src/app/admin/news/page.tsx` — news moderation page (server component)
- `src/app/admin/demands/page.tsx` — demand signals moderation page (server component)
- `src/app/admin/tutorials/page.tsx` — tutorial list page (server component)
- `src/app/admin/tutorials/new/page.tsx` — new tutorial editor
- `src/app/admin/tutorials/[id]/edit/page.tsx` — edit tutorial
- `src/app/admin/categories/page.tsx` — series management page
- `src/components/admin/sidebar.tsx` — admin sidebar navigation
- `src/components/admin/moderation-table.tsx` — shared moderation list (client component)
- `src/components/admin/tutorial-editor.tsx` — Markdown editor wrapper (client, responsive)
- `src/app/api/admin/news/moderate/route.ts` — POST approve/reject news
- `src/app/api/admin/demands/moderate/route.ts` — POST approve/reject demands
- `src/app/api/admin/tutorials/route.ts` — POST create tutorial
- `src/app/api/admin/tutorials/[id]/route.ts` — PATCH/DELETE tutorial
- `src/app/api/admin/categories/route.ts` — POST create category
- `src/app/api/admin/categories/[id]/route.ts` — PATCH/DELETE category

**Modified files:**
- `src/lib/supabase/types.ts` — add `status` to `news_items`, add `"pending"` to `demand_signals.status`
- `src/app/news/page.tsx` — add `.eq('status', 'approved')` filter
- `src/app/demands/page.tsx` — keep `.eq('status', 'active')` (already correct)
- `services/backend/src/queues/ai-demand-analysis.ts` — change `status: "active"` → `status: "pending"`

**Test files:**
- `tests/middleware/admin-guard.test.ts` — middleware redirects non-admin
- `tests/components/admin/moderation-table.test.tsx` — bulk select, approve, reject
- `tests/components/admin/tutorial-editor.test.tsx` — file upload, editor content, responsive

---

## Task 1: DB Migration — Add status to news_items and demand_signals

**Files:**
- Create: `supabase/migrations/006_admin_moderation.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/006_admin_moderation.sql

-- Add status column to news_items
alter table public.news_items
  add column status text not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));

create index news_items_status_idx on public.news_items(status);

-- Update RLS for news_items: public sees only approved, admins see all
drop policy if exists "News items are viewable by everyone" on public.news_items;

create policy "Approved news items are publicly readable"
  on public.news_items for select
  using (status = 'approved');

create policy "Admins can manage news items"
  on public.news_items for all
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ));

-- Add 'pending' to demand_signals status
alter table public.demand_signals
  drop constraint demand_signals_status_check;

alter table public.demand_signals
  add constraint demand_signals_status_check
  check (status in ('pending', 'active', 'archived', 'dismissed'));

alter table public.demand_signals
  alter column status set default 'pending';

-- Update RLS for demand_signals: public sees only active, admins see all
drop policy if exists "Active demand signals are viewable by everyone" on public.demand_signals;

create policy "Active demand signals are publicly readable"
  on public.demand_signals for select
  using (status = 'active');

create policy "Admins can manage demand signals"
  on public.demand_signals for all
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ));
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Copy the contents of `supabase/migrations/006_admin_moderation.sql` and execute in the Supabase Dashboard → SQL Editor.

Expected: no errors. Verify:
```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'news_items' and column_name = 'status';
-- Should return: status | text | 'pending'::text
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_admin_moderation.sql
git commit -m "feat: add status column to news_items and pending to demand_signals"
```

---

## Task 2: TypeScript Types Update

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Update news_items Row type** — add `status` field after `engagement_score`:

```ts
// In news_items.Row, after engagement_score:
status: "pending" | "approved" | "rejected";
```

Full updated `news_items` block:
```ts
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
    status: "pending" | "approved" | "rejected";
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
```

- [ ] **Step 2: Update demand_signals Row type** — add `"pending"` to status union:

```ts
status: "pending" | "active" | "archived" | "dismissed";
```

Full updated `demand_signals` block:
```ts
demand_signals: {
  Row: {
    id: string;
    news_item_id: string;
    signal_type: "pain_point" | "solution_req" | "trending";
    score: number;
    market_size_est: string | null;
    competition_lvl: "low" | "medium" | "high" | null;
    ai_analysis: string | null;
    status: "pending" | "active" | "archived" | "dismissed";
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

- [ ] **Step 3: Run TypeScript check**

```bash
cd /Users/lwx/Workspace/partime/lighthouse
npx tsc --noEmit
```

Expected: no errors (or same errors as before this change).

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat: update types for news_items status and demand_signals pending"
```

---

## Task 3: Backend Worker Change

**Files:**
- Modify: `services/backend/src/queues/ai-demand-analysis.ts` (line 143)

- [ ] **Step 1: Change default status to pending**

In `ai-demand-analysis.ts`, find the `supabase.from("demand_signals").insert(...)` call and change `status: "active"` to `status: "pending"`:

```ts
await supabase.from("demand_signals").insert({
  news_item_id: item.id,
  signal_type: result.signal_type,
  score: result.score,
  market_size_est: result.market_size_est,
  competition_lvl: result.competition_lvl,
  ai_analysis: result.ai_analysis,
  status: "pending",  // changed from "active"
});
```

- [ ] **Step 2: Run backend tests**

```bash
cd /Users/lwx/Workspace/partime/lighthouse/services/backend
pnpm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add services/backend/src/queues/ai-demand-analysis.ts
git commit -m "feat: new demand signals default to pending status for moderation"
```

---

## Task 4: Update Frontend Queries (news_items filter)

**Files:**
- Modify: `src/app/news/page.tsx`

- [ ] **Step 1: Add status filter to news query**

In `src/app/news/page.tsx`, add `.eq("status", "approved")` to the `news_items` query:

```ts
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
      .eq("status", "approved")
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

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/lwx/Workspace/partime/lighthouse
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/news/page.tsx
git commit -m "feat: filter news items by approved status on frontend"
```

---

## Task 5: Install @uiw/react-md-editor

**Files:**
- Modify: `package.json` (via pnpm add)

- [ ] **Step 1: Install the package**

```bash
cd /Users/lwx/Workspace/partime/lighthouse
pnpm add @uiw/react-md-editor
```

Expected: package added to `dependencies`.

- [ ] **Step 2: Verify it resolves**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @uiw/react-md-editor for admin tutorial editor"
```

---

## Task 6: Middleware — Admin Route Guard

**Files:**
- Modify: `src/middleware.ts`
- Modify: `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Write failing test**

Create `tests/middleware/admin-guard.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

// We test the admin guard logic in isolation by extracting it
// The guard function takes: pathname, getUser result, getProfile result
// Returns: "allow" | "redirect:/login?next=/admin" | "redirect:/"

type GuardResult =
  | { action: "allow" }
  | { action: "redirect"; to: string };

async function adminGuard(
  pathname: string,
  user: { id: string } | null,
  role: "admin" | "user" | null
): Promise<GuardResult> {
  if (!pathname.startsWith("/admin")) return { action: "allow" };
  if (!user) return { action: "redirect", to: `/login?next=${pathname}` };
  if (role !== "admin") return { action: "redirect", to: "/" };
  return { action: "allow" };
}

describe("adminGuard", () => {
  it("allows non-admin paths without auth", async () => {
    const result = await adminGuard("/news", null, null);
    expect(result).toEqual({ action: "allow" });
  });

  it("redirects to login when unauthenticated on /admin path", async () => {
    const result = await adminGuard("/admin/news", null, null);
    expect(result).toEqual({ action: "redirect", to: "/login?next=/admin/news" });
  });

  it("redirects to home when authenticated but not admin", async () => {
    const result = await adminGuard("/admin/news", { id: "user-1" }, "user");
    expect(result).toEqual({ action: "redirect", to: "/" });
  });

  it("allows admin user through", async () => {
    const result = await adminGuard("/admin/news", { id: "admin-1" }, "admin");
    expect(result).toEqual({ action: "allow" });
  });
});
```

- [ ] **Step 2: Run test to confirm it passes (logic is in test itself)**

```bash
cd /Users/lwx/Workspace/partime/lighthouse
npx vitest run tests/middleware/admin-guard.test.ts
```

Expected: 4 tests pass (guard logic is self-contained in the test).

- [ ] **Step 3: Implement middleware admin guard**

Replace `src/middleware.ts`:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Only guard /admin/* paths
  if (!pathname.startsWith("/admin")) {
    return response;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 4: Run all frontend tests**

```bash
cd /Users/lwx/Workspace/partime/lighthouse
npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts tests/middleware/admin-guard.test.ts
git commit -m "feat: add admin route guard to middleware"
```

---

## Task 7: Admin Layout and Sidebar

**Files:**
- Create: `src/components/admin/sidebar.tsx`
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`

- [ ] **Step 1: Create admin sidebar component**

Create `src/components/admin/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin/news", label: "内容审核 · 新闻" },
  { href: "/admin/demands", label: "内容审核 · 需求信号" },
  { href: "/admin/tutorials", label: "教程管理" },
  { href: "/admin/categories", label: "系列管理" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-muted/30 px-3 py-6">
      <div className="mb-6 px-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          管理后台
        </h2>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === item.href
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Create admin layout**

Create `src/app/admin/layout.tsx`:

```tsx
import { AdminSidebar } from "@/components/admin/sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Create admin root page (redirect)**

Create `src/app/admin/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function AdminPage() {
  redirect("/admin/news");
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/sidebar.tsx src/app/admin/layout.tsx src/app/admin/page.tsx
git commit -m "feat: add admin layout with sidebar navigation"
```

---

## Task 8: ModerationTable Client Component

**Files:**
- Create: `src/components/admin/moderation-table.tsx`
- Create: `tests/components/admin/moderation-table.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/components/admin/moderation-table.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ModerationTable } from "@/components/admin/moderation-table";

const mockItems = [
  {
    id: "1",
    title: "News Item 1",
    meta: "HackerNews · 2026-04-06",
    badge: "pending" as const,
  },
  {
    id: "2",
    title: "News Item 2",
    meta: "Reddit · 2026-04-05",
    badge: "pending" as const,
  },
];

describe("ModerationTable", () => {
  it("renders items in the list", () => {
    render(
      <ModerationTable
        items={mockItems}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText("News Item 1")).toBeInTheDocument();
    expect(screen.getByText("News Item 2")).toBeInTheDocument();
  });

  it("calls onApprove with item id when approve button clicked", () => {
    const onApprove = vi.fn();
    render(
      <ModerationTable
        items={mockItems}
        onApprove={onApprove}
        onReject={vi.fn()}
      />
    );
    const approveButtons = screen.getAllByText("通过");
    fireEvent.click(approveButtons[0]);
    expect(onApprove).toHaveBeenCalledWith(["1"]);
  });

  it("calls onReject with item id when reject button clicked", () => {
    const onReject = vi.fn();
    render(
      <ModerationTable
        items={mockItems}
        onApprove={vi.fn()}
        onReject={onReject}
      />
    );
    const rejectButtons = screen.getAllByText("拒绝");
    fireEvent.click(rejectButtons[0]);
    expect(onReject).toHaveBeenCalledWith(["1"]);
  });

  it("selects all items when 全选 is clicked", () => {
    const onApprove = vi.fn();
    render(
      <ModerationTable
        items={mockItems}
        onApprove={onApprove}
        onReject={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("全选"));
    fireEvent.click(screen.getByText("批量通过"));
    expect(onApprove).toHaveBeenCalledWith(["1", "2"]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/lwx/Workspace/partime/lighthouse
npx vitest run tests/components/admin/moderation-table.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ModerationTable**

Create `src/components/admin/moderation-table.tsx`:

```tsx
"use client";

import { useState } from "react";

export interface ModerationItem {
  id: string;
  title: string;
  meta: string;
  badge: "pending" | "approved" | "rejected" | "active" | "dismissed";
}

interface ModerationTableProps {
  items: ModerationItem[];
  onApprove: (ids: string[]) => void;
  onReject: (ids: string[]) => void;
}

const BADGE_STYLES: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  approved: "bg-green-500/10 text-green-500",
  active: "bg-green-500/10 text-green-500",
  rejected: "bg-red-500/10 text-red-500",
  dismissed: "bg-red-500/10 text-red-500",
};

const BADGE_LABELS: Record<string, string> = {
  pending: "待审核",
  approved: "已通过",
  active: "已通过",
  rejected: "已拒绝",
  dismissed: "已拒绝",
};

export function ModerationTable({
  items,
  onApprove,
  onReject,
}: ModerationTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(items.map((i) => i.id)));
  };

  const clearSelection = () => setSelected(new Set());

  return (
    <div className="space-y-3">
      {/* Bulk actions */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={selectAll}
          className="rounded border px-2 py-1 hover:bg-accent"
        >
          全选
        </button>
        {selected.size > 0 && (
          <>
            <span className="text-muted-foreground">
              已选 {selected.size} 条
            </span>
            <button
              onClick={() => {
                onApprove([...selected]);
                clearSelection();
              }}
              className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700"
            >
              批量通过
            </button>
            <button
              onClick={() => {
                onReject([...selected]);
                clearSelection();
              }}
              className="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700"
            >
              批量拒绝
            </button>
          </>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            暂无内容
          </p>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="h-4 w-4 rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.meta}</p>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-xs ${BADGE_STYLES[item.badge] ?? ""}`}
                >
                  {BADGE_LABELS[item.badge] ?? item.badge}
                </span>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => onApprove([item.id])}
                    className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                  >
                    通过
                  </button>
                  <button
                    onClick={() => onReject([item.id])}
                    className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                  >
                    拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/lwx/Workspace/partime/lighthouse
npx vitest run tests/components/admin/moderation-table.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/moderation-table.tsx tests/components/admin/moderation-table.test.tsx
git commit -m "feat: add ModerationTable component with bulk approve/reject"
```

---

## Task 9: Admin News Moderation Page + API Route

**Files:**
- Create: `src/app/admin/news/page.tsx`
- Create: `src/app/api/admin/news/moderate/route.ts`

- [ ] **Step 1: Create API route for news moderation**

Create `src/app/api/admin/news/moderate/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { ids, action } = body as { ids: string[]; action: "approve" | "reject" };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";

  const { error } = await supabase
    .from("news_items")
    .update({ status: newStatus })
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: ids.length });
}
```

- [ ] **Step 2: Create news moderation page**

Create `src/app/admin/news/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { ModerationTable, type ModerationItem } from "@/components/admin/moderation-table";

type StatusFilter = "pending" | "approved" | "rejected";

const TAB_LABELS: Record<StatusFilter, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
};

export default function AdminNewsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async (status: StatusFilter) => {
    setLoading(true);
    const res = await fetch(`/api/admin/news?status=${status}`);
    if (res.ok) {
      const data = await res.json();
      setItems(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data.items ?? []).map((item: any) => ({
          id: item.id,
          title: item.title,
          meta: `${item.source_name ?? "未知来源"} · ${new Date(item.published_at).toLocaleDateString("zh-CN")}`,
          badge: item.status,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems(statusFilter);
  }, [statusFilter]);

  const moderate = async (ids: string[], action: "approve" | "reject") => {
    await fetch("/api/admin/news/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action }),
    });
    fetchItems(statusFilter);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">新闻审核</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(Object.keys(TAB_LABELS) as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-sm transition-colors ${
              statusFilter === s
                ? "border-b-2 border-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {TAB_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : (
        <ModerationTable
          items={items}
          onApprove={(ids) => moderate(ids, "approve")}
          onReject={(ids) => moderate(ids, "reject")}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the GET route for news list**

Create `src/app/api/admin/news/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = request.nextUrl.searchParams.get("status") ?? "pending";

  const { data: items, error } = await supabase
    .from("news_items")
    .select("id, title, status, published_at, source_id, sources(name)")
    .eq("status", status)
    .order("published_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = (items ?? []).map((item: any) => ({
    ...item,
    source_name: item.sources?.name ?? null,
  }));

  return NextResponse.json({ items: mapped });
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
cd /Users/lwx/Workspace/partime/lighthouse
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/news/ src/app/api/admin/news/
git commit -m "feat: add admin news moderation page and API routes"
```

---

## Task 10: Admin Demands Moderation Page + API Route

**Files:**
- Create: `src/app/admin/demands/page.tsx`
- Create: `src/app/api/admin/demands/route.ts`
- Create: `src/app/api/admin/demands/moderate/route.ts`

- [ ] **Step 1: Create API route for demands moderation**

Create `src/app/api/admin/demands/moderate/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { ids, action } = body as { ids: string[]; action: "approve" | "reject" };

  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  if (action !== "approve" && action !== "reject")
    return NextResponse.json({ error: "invalid action" }, { status: 400 });

  // approve → "active", reject → "dismissed"
  const newStatus = action === "approve" ? "active" : "dismissed";

  const { error } = await supabase
    .from("demand_signals")
    .update({ status: newStatus })
    .in("id", ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, updated: ids.length });
}
```

- [ ] **Step 2: Create GET route for demands list**

Create `src/app/api/admin/demands/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = request.nextUrl.searchParams.get("status") ?? "pending";

  const { data: items, error } = await supabase
    .from("demand_signals")
    .select("id, signal_type, score, status, created_at, news_item_id, news_items(title)")
    .eq("status", status)
    .order("score", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: items ?? [] });
}
```

- [ ] **Step 3: Create demands moderation page**

Create `src/app/admin/demands/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { ModerationTable, type ModerationItem } from "@/components/admin/moderation-table";

type StatusFilter = "pending" | "active" | "dismissed";

const TAB_LABELS: Record<StatusFilter, string> = {
  pending: "待审核",
  active: "已通过",
  dismissed: "已拒绝",
};

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  pain_point: "痛点",
  solution_req: "需求",
  trending: "趋势",
};

export default function AdminDemandsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async (status: StatusFilter) => {
    setLoading(true);
    const res = await fetch(`/api/admin/demands?status=${status}`);
    if (res.ok) {
      const data = await res.json();
      setItems(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data.items ?? []).map((item: any) => ({
          id: item.id,
          title: item.news_items?.title ?? "未知新闻",
          meta: `${SIGNAL_TYPE_LABELS[item.signal_type] ?? item.signal_type} · 评分 ${item.score}`,
          badge: item.status,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems(statusFilter);
  }, [statusFilter]);

  const moderate = async (ids: string[], action: "approve" | "reject") => {
    await fetch("/api/admin/demands/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action }),
    });
    fetchItems(statusFilter);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">需求信号审核</h1>

      <div className="flex gap-1 border-b">
        {(Object.keys(TAB_LABELS) as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-sm transition-colors ${
              statusFilter === s
                ? "border-b-2 border-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {TAB_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : (
        <ModerationTable
          items={items}
          onApprove={(ids) => moderate(ids, "approve")}
          onReject={(ids) => moderate(ids, "reject")}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/lwx/Workspace/partime/lighthouse
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/demands/ src/app/api/admin/demands/
git commit -m "feat: add admin demands moderation page and API routes"
```

---

## Task 11: TutorialEditor Component

**Files:**
- Create: `src/components/admin/tutorial-editor.tsx`
- Create: `tests/components/admin/tutorial-editor.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/components/admin/tutorial-editor.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TutorialEditor } from "@/components/admin/tutorial-editor";

// Mock @uiw/react-md-editor since it uses browser APIs
vi.mock("@uiw/react-md-editor", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="md-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

describe("TutorialEditor", () => {
  it("renders with initial value", () => {
    render(
      <TutorialEditor value="# Hello" onChange={vi.fn()} />
    );
    expect(screen.getByTestId("md-editor")).toHaveValue("# Hello");
  });

  it("calls onChange when editor content changes", () => {
    const onChange = vi.fn();
    render(<TutorialEditor value="" onChange={onChange} />);
    fireEvent.change(screen.getByTestId("md-editor"), {
      target: { value: "# New content" },
    });
    expect(onChange).toHaveBeenCalledWith("# New content");
  });

  it("renders file upload button", () => {
    render(<TutorialEditor value="" onChange={vi.fn()} />);
    expect(screen.getByText("上传 .md 文件")).toBeInTheDocument();
  });

  it("reads uploaded .md file and calls onChange", async () => {
    const onChange = vi.fn();
    render(<TutorialEditor value="" onChange={onChange} />);

    const fileInput = screen.getByLabelText("上传 .md 文件");
    const file = new File(["# Uploaded"], "test.md", { type: "text/markdown" });

    // Mock FileReader
    const mockReadAsText = vi.fn();
    const mockFileReader = {
      readAsText: mockReadAsText,
      onload: null as ((e: ProgressEvent<FileReader>) => void) | null,
      result: "# Uploaded",
    };
    vi.spyOn(global, "FileReader").mockImplementation(() => mockFileReader as unknown as FileReader);

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Trigger the onload callback
    mockFileReader.onload?.({ target: mockFileReader } as unknown as ProgressEvent<FileReader>);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("# Uploaded");
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/lwx/Workspace/partime/lighthouse
npx vitest run tests/components/admin/tutorial-editor.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement TutorialEditor**

Create `src/components/admin/tutorial-editor.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";

// Dynamically import to avoid SSR issues
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface TutorialEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function TutorialEditor({ value, onChange }: TutorialEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === "string") {
        onChange(content);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      {/* File upload */}
      <div>
        <label
          htmlFor="md-file-upload"
          className="cursor-pointer rounded border px-3 py-1.5 text-sm hover:bg-accent"
        >
          上传 .md 文件
        </label>
        <input
          id="md-file-upload"
          ref={fileInputRef}
          type="file"
          accept=".md,text/markdown"
          onChange={handleFileUpload}
          className="sr-only"
          aria-label="上传 .md 文件"
        />
      </div>

      {/* Editor — split pane on lg, tab mode below */}
      <div data-color-mode="dark">
        <MDEditor
          value={value}
          onChange={(v) => onChange(v ?? "")}
          height={500}
          preview="live"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/lwx/Workspace/partime/lighthouse
npx vitest run tests/components/admin/tutorial-editor.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/tutorial-editor.tsx tests/components/admin/tutorial-editor.test.tsx
git commit -m "feat: add TutorialEditor component with file upload and MD editor"
```

---

## Task 12: Tutorial & Category API Routes

**Files:**
- Create: `src/app/api/admin/tutorials/route.ts`
- Create: `src/app/api/admin/tutorials/[id]/route.ts`
- Create: `src/app/api/admin/categories/route.ts`
- Create: `src/app/api/admin/categories/[id]/route.ts`

- [ ] **Step 1: Create tutorial API routes**

Create `src/app/api/admin/tutorials/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

export async function GET() {
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("tutorials")
    .select("id, title, slug, status, category_id, updated_at, categories(name)")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tutorials: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { title, slug, content, category_id, is_free, status } = body as {
    title: string;
    slug: string;
    content: string;
    category_id?: string | null;
    is_free?: boolean;
    status?: "draft" | "published";
  };

  if (!title || !slug || !content) {
    return NextResponse.json({ error: "title, slug, content required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tutorials")
    .insert({
      title,
      slug,
      content,
      category_id: category_id ?? null,
      is_free: is_free ?? true,
      status: status ?? "draft",
      order: 0,
      read_time_minutes: Math.ceil(content.split(/\s+/).length / 200),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tutorial: data }, { status: 201 });
}
```

Create `src/app/api/admin/tutorials/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { data, error } = await supabase
    .from("tutorials").select("*").eq("id", id).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ tutorial: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.slug !== undefined) updates.slug = body.slug;
  if (body.content !== undefined) {
    updates.content = body.content;
    updates.read_time_minutes = Math.ceil(body.content.split(/\s+/).length / 200);
  }
  if (body.status !== undefined) updates.status = body.status;
  if (body.category_id !== undefined) updates.category_id = body.category_id;
  if (body.is_free !== undefined) updates.is_free = body.is_free;

  const { data, error } = await supabase
    .from("tutorials").update(updates).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tutorial: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { error } = await supabase.from("tutorials").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create category API routes**

Create `src/app/api/admin/categories/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

export async function GET() {
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, tutorials(id)")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = (data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    tutorial_count: Array.isArray(c.tutorials) ? c.tutorials.length : 0,
  }));

  return NextResponse.json({ categories: mapped });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { name, slug } = body as { name: string; slug: string };

  if (!name || !slug) {
    return NextResponse.json({ error: "name and slug required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({ name, slug, order: 0 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data }, { status: 201 });
}
```

Create `src/app/api/admin/categories/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const { data, error } = await supabase
    .from("categories")
    .update({ name: body.name, slug: body.slug })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Check if tutorials exist in this category
  const { count } = await supabase
    .from("tutorials")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: "该系列下还有教程，无法删除" },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/lwx/Workspace/partime/lighthouse
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/
git commit -m "feat: add admin API routes for tutorials and categories"
```

---

## Task 13: Tutorial List, New, Edit, Categories Admin Pages

**Files:**
- Create: `src/app/admin/tutorials/page.tsx`
- Create: `src/app/admin/tutorials/new/page.tsx`
- Create: `src/app/admin/tutorials/[id]/edit/page.tsx`
- Create: `src/app/admin/categories/page.tsx`

- [ ] **Step 1: Create tutorial list page**

Create `src/app/admin/tutorials/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface TutorialRow {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  category_id: string | null;
  updated_at: string;
  categories: { name: string } | null;
}

export default function AdminTutorialsPage() {
  const [tutorials, setTutorials] = useState<TutorialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchTutorials = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/tutorials");
    if (res.ok) {
      const data = await res.json();
      setTutorials(data.tutorials ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTutorials(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除这篇教程？")) return;
    await fetch(`/api/admin/tutorials/${id}`, { method: "DELETE" });
    fetchTutorials();
  };

  const handleToggleStatus = async (id: string, current: "draft" | "published") => {
    const newStatus = current === "draft" ? "published" : "draft";
    await fetch(`/api/admin/tutorials/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchTutorials();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">教程管理</h1>
        <Link
          href="/admin/tutorials/new"
          className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          新建教程
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : tutorials.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无教程</p>
      ) : (
        <div className="rounded-lg border">
          <div className="divide-y">
            {tutorials.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.categories?.name ?? "无系列"} ·{" "}
                    {new Date(t.updated_at).toLocaleDateString("zh-CN")}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-xs ${
                    t.status === "published"
                      ? "bg-green-500/10 text-green-500"
                      : "bg-yellow-500/10 text-yellow-500"
                  }`}
                >
                  {t.status === "published" ? "已发布" : "草稿"}
                </span>
                <div className="flex gap-2 shrink-0 text-xs">
                  <button
                    onClick={() => router.push(`/admin/tutorials/${t.id}/edit`)}
                    className="rounded border px-2 py-1 hover:bg-accent"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleToggleStatus(t.id, t.status)}
                    className="rounded border px-2 py-1 hover:bg-accent"
                  >
                    {t.status === "draft" ? "发布" : "取消发布"}
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="rounded border border-red-500/30 px-2 py-1 text-red-500 hover:bg-red-500/10"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create shared tutorial form component (inline in new/edit pages)**

Create `src/app/admin/tutorials/new/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TutorialEditor } from "@/components/admin/tutorial-editor";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .slice(0, 80);
}

export default function NewTutorialPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [isFree, setIsFree] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTitleChange = (v: string) => {
    setTitle(v);
    setSlug(slugify(v));
  };

  const save = async (status: "draft" | "published") => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/tutorials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        slug,
        content,
        category_id: categoryId || null,
        is_free: isFree,
        status,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "保存失败");
      return;
    }
    router.push("/admin/tutorials");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">新建教程</h1>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">标题</label>
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
            placeholder="教程标题"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm font-mono"
            placeholder="tutorial-slug"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is-free"
            checked={isFree}
            onChange={(e) => setIsFree(e.target.checked)}
          />
          <label htmlFor="is-free" className="text-sm">免费教程</label>
        </div>

        <div>
          <label className="text-sm font-medium">内容</label>
          <div className="mt-1">
            <TutorialEditor value={content} onChange={setContent} />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => save("draft")}
          disabled={saving || !title || !slug}
          className="rounded border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          保存草稿
        </button>
        <button
          onClick={() => save("published")}
          disabled={saving || !title || !slug}
          className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          发布
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create edit tutorial page**

Create `src/app/admin/tutorials/[id]/edit/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { TutorialEditor } from "@/components/admin/tutorial-editor";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .slice(0, 80);
}

export default function EditTutorialPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [isFree, setIsFree] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/tutorials/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const t = data.tutorial;
        if (t) {
          setTitle(t.title);
          setSlug(t.slug);
          setContent(t.content);
          setStatus(t.status);
          setIsFree(t.is_free);
        }
        setLoading(false);
      });
  }, [id]);

  const save = async (newStatus: "draft" | "published") => {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/tutorials/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug, content, status: newStatus, is_free: isFree }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "保存失败");
      return;
    }
    router.push("/admin/tutorials");
  };

  if (loading) return <p className="text-sm text-muted-foreground">加载中...</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">编辑教程</h1>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">标题</label>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSlug(slugify(e.target.value));
            }}
            className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is-free"
            checked={isFree}
            onChange={(e) => setIsFree(e.target.checked)}
          />
          <label htmlFor="is-free" className="text-sm">免费教程</label>
        </div>

        <div>
          <label className="text-sm font-medium">内容</label>
          <div className="mt-1">
            <TutorialEditor value={content} onChange={setContent} />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => save("draft")}
          disabled={saving}
          className="rounded border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          保存草稿
        </button>
        {status === "published" ? (
          <button
            onClick={() => save("draft")}
            disabled={saving}
            className="rounded border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            取消发布
          </button>
        ) : (
          <button
            onClick={() => save("published")}
            disabled={saving}
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            发布
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create categories management page**

Create `src/app/admin/categories/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface Category {
  id: string;
  name: string;
  slug: string;
  tutorial_count: number;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/categories");
    if (res.ok) {
      const data = await res.json();
      setCategories(data.categories ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleCreate = async () => {
    if (!newName || !newSlug) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, slug: newSlug }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { setError(data.error); return; }
    setNewName("");
    setNewSlug("");
    fetchCategories();
  };

  const handleRename = async (id: string) => {
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, slug: editSlug }),
    });
    if (res.ok) {
      setEditingId(null);
      fetchCategories();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除该系列？")) return;
    const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    fetchCategories();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">系列管理</h1>

      {/* Create form */}
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => { setNewName(e.target.value); setNewSlug(slugify(e.target.value)); }}
          placeholder="系列名称"
          className="rounded border bg-background px-3 py-2 text-sm"
        />
        <input
          value={newSlug}
          onChange={(e) => setNewSlug(e.target.value)}
          placeholder="slug"
          className="rounded border bg-background px-3 py-2 text-sm font-mono"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newName || !newSlug}
          className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          新建系列
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : (
        <div className="rounded-lg border">
          <div className="divide-y">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
                {editingId === cat.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded border bg-background px-2 py-1 text-sm"
                    />
                    <input
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value)}
                      className="rounded border bg-background px-2 py-1 text-sm font-mono"
                    />
                    <button
                      onClick={() => handleRename(cat.id)}
                      className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded border px-3 py-1 text-xs"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{cat.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{cat.slug} · {cat.tutorial_count} 篇教程</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingId(cat.id);
                        setEditName(cat.name);
                        setEditSlug(cat.slug);
                      }}
                      className="rounded border px-2 py-1 text-xs hover:bg-accent"
                    >
                      重命名
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      disabled={cat.tutorial_count > 0}
                      className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                      title={cat.tutorial_count > 0 ? "该系列下有教程，无法删除" : undefined}
                    >
                      删除
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/lwx/Workspace/partime/lighthouse
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run all tests**

```bash
cd /Users/lwx/Workspace/partime/lighthouse
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/tutorials/ src/app/admin/categories/
git commit -m "feat: add tutorial list, new, edit, and categories admin pages"
```

---

## Task 14: Build Verification

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/lwx/Workspace/partime/lighthouse
npx vitest run
```

Expected: all tests pass (including new admin tests).

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete admin panel — moderation, tutorial management, middleware guard"
```
