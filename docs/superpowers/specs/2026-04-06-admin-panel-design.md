# Admin Panel Design

**Date:** 2026-04-06
**Status:** Approved

## Goal

Add an admin panel at `/admin` to the existing Next.js app with three capabilities:
1. Route-level access control — only users with `role = 'admin'` can access `/admin/*`
2. Content moderation — review and approve/reject auto-collected news and demand signals before they appear on the frontend
3. Tutorial management — create, edit (with Markdown editor), and publish tutorials and tutorial series

---

## Architecture

All admin functionality lives inside the existing Next.js project under `src/app/admin/`. No new services or frameworks are introduced. The existing Supabase auth, `profiles.role` field, and shadcn/ui component library are reused throughout.

The backend data collection workers (Fastify + BullMQ) continue to run independently and unchanged, except for the default `status` value they write when inserting new records.

---

## 1. Permission Control

### Middleware

Extend `src/middleware.ts` to intercept all `/admin/*` requests:

1. Call `supabase.auth.getUser()` to get the current session
2. If no session → redirect to `/login?next=/admin`
3. If session exists → query `profiles.role` for that user
4. If `role !== 'admin'` → redirect to `/` with no error message
5. If `role === 'admin'` → allow request through

This single check protects all admin routes automatically. Individual admin pages do not need their own auth checks.

### Setting Admin Users

Admin users are designated manually via Supabase SQL Editor:

```sql
update profiles set role = 'admin' where id = '<user_uuid>';
```

No UI is needed for this — it's a deliberate low-frequency operation done by the system owner.

### Admin Layout

`src/app/admin/layout.tsx` — shared layout for all admin pages with:
- Fixed left sidebar (240px) with navigation links
- Main content area
- Sidebar links: 内容审核 (新闻、需求信号), 教程管理, 系列管理

---

## 2. Content Moderation

### Database Changes

**Migration 006_admin_moderation.sql:**

`news_items` table — add `status` column:
```sql
alter table public.news_items
  add column status text not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));

-- Index for admin list queries
create index news_items_status_idx on public.news_items(status);

-- Update RLS: public can only see approved items
drop policy if exists "News items are publicly readable" on public.news_items;
create policy "Approved news items are publicly readable"
  on public.news_items for select
  using (status = 'approved');

create policy "Admins can manage news items"
  on public.news_items for all
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ));
```

`demand_signals` table — add `'pending'` to status enum:
```sql
alter table public.demand_signals
  drop constraint demand_signals_status_check;
alter table public.demand_signals
  add constraint demand_signals_status_check
  check (status in ('pending', 'active', 'archived', 'dismissed'));

-- Default new signals to pending
alter table public.demand_signals
  alter column status set default 'pending';

-- Update RLS: public can only see active items
drop policy if exists "Demand signals are publicly readable" on public.demand_signals;
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

### Backend Worker Changes

- `services/backend/src/queues/collect-hn.ts`, `collect-ph.ts`, `collect-reddit.ts`, `collect-rss.ts` — no change needed (news_items default is now `'pending'`)
- `services/backend/src/queues/ai-demand-analysis.ts` — change `status: "active"` to `status: "pending"` when inserting demand_signals

### Frontend Query Changes

- `src/app/news/news-page-client.tsx` (or page.tsx) — add `.eq('status', 'approved')` filter
- `src/app/demands/page.tsx` — keep `.eq('status', 'active')` (admin approves by setting to 'active')

### Admin Pages

**`/admin/news`** — News moderation list
- Server component fetches news with status filter (default: pending)
- Tab bar: 待审核 / 已通过 / 已拒绝
- Each row shows: title, source, published_at, ai_tags, ai_summary, action buttons
- Actions per row: ✓ 通过 | ✗ 拒绝
- Bulk actions: checkbox column, 全选, 批量通过, 批量拒绝 buttons
- Client component handles optimistic updates via `/api/admin/news` PATCH endpoint

**`/admin/demands`** — Demand signal moderation list
- Same layout as news moderation
- Status flow: `pending → active` (approve) or `pending → dismissed` (reject)
- Each row shows: title, score, related news title, tags, action buttons
- Same bulk action support

**API Routes:**
- `POST /api/admin/news/moderate` — body: `{ ids: string[], action: 'approve' | 'reject' }`
- `POST /api/admin/demands/moderate` — body: `{ ids: string[], action: 'approve' | 'reject' }`
- Both routes verify admin role server-side before executing

---

## 3. Tutorial Management

### Tutorial Editor

Uses `@uiw/react-md-editor` package — lightweight, zero dependencies, supports preview mode.

**Responsive behavior:**
- ≥1024px (lg breakpoint): split-pane mode (editor left, preview right, real-time)
- <1024px: tab mode (Edit tab / Preview tab)

**File upload:** A file input accepts `.md` files. On selection, `FileReader` reads the text content and sets it as the editor value. The user can then edit in the browser.

### Pages

**`/admin/tutorials`** — Tutorial list
- Table with columns: title, series, status (draft/published), updated_at, actions
- Filter by status (all / draft / published)
- Filter by series
- Actions: Edit, Delete, Publish/Unpublish toggle
- "新建教程" button → `/admin/tutorials/new`

**`/admin/tutorials/new`** and **`/admin/tutorials/[id]/edit`** — Tutorial editor
- Fields: title, slug (auto-generated from title, editable), series (dropdown + "新建系列" inline option), is_free toggle
- Markdown editor (full width, responsive split/tab)
- Upload .md file button (top of editor)
- Bottom action bar: 保存草稿 | 发布 | (if published) 取消发布
- Saving draft → `status: 'draft'`, publishing → `status: 'published'`

**`/admin/categories`** — Series management
- List of all tutorial series (name, slug, tutorial count)
- Inline create: "新建系列" form at top (name + slug)
- Inline rename
- Delete (only if no tutorials in series)

### Data Flow

```
Admin uploads .md or writes in editor
    ↓
Save as draft (status: 'draft') — not visible on frontend
    ↓
Admin clicks 发布 (status: 'published')
    ↓
Frontend tutorials pages show it (already filter by status='published')
```

No additional RLS changes needed — existing policies already allow admins to manage tutorials and only show published ones to the public.

### API Routes

- `POST /api/admin/tutorials` — create tutorial
- `PATCH /api/admin/tutorials/[id]` — update tutorial (content, status, series)
- `DELETE /api/admin/tutorials/[id]` — delete tutorial
- `POST /api/admin/categories` — create series
- `PATCH /api/admin/categories/[id]` — rename series
- `DELETE /api/admin/categories/[id]` — delete series (fails if tutorials exist)

---

## File Structure

```
src/
├── app/
│   └── admin/
│       ├── layout.tsx                    # Admin layout with sidebar
│       ├── page.tsx                      # Admin dashboard (redirect to /admin/news)
│       ├── news/
│       │   └── page.tsx                  # News moderation
│       ├── demands/
│       │   └── page.tsx                  # Demand signal moderation
│       ├── tutorials/
│       │   ├── page.tsx                  # Tutorial list
│       │   ├── new/
│       │   │   └── page.tsx              # New tutorial editor
│       │   └── [id]/
│       │       └── edit/
│       │           └── page.tsx          # Edit tutorial
│       └── categories/
│           └── page.tsx                  # Series management
├── components/
│   └── admin/
│       ├── moderation-table.tsx          # Shared moderation list component
│       ├── bulk-actions.tsx              # Checkbox + bulk approve/reject
│       ├── tutorial-editor.tsx           # MD editor wrapper (responsive)
│       └── sidebar.tsx                   # Admin sidebar navigation
└── app/
    └── api/
        └── admin/
            ├── news/
            │   └── moderate/
            │       └── route.ts
            ├── demands/
            │   └── moderate/
            │       └── route.ts
            ├── tutorials/
            │   ├── route.ts
            │   └── [id]/
            │       └── route.ts
            └── categories/
                ├── route.ts
                └── [id]/
                    └── route.ts

supabase/migrations/
└── 006_admin_moderation.sql              # news_items status + demand_signals pending status

services/backend/src/queues/
└── ai-demand-analysis.ts                 # Change default status to 'pending'
```

---

## TypeScript Types

`src/lib/supabase/types.ts` — update `news_items` Row/Insert/Update to include:
```ts
status: "pending" | "approved" | "rejected";
```

Update `demand_signals` status union to include `"pending"`:
```ts
status: "pending" | "active" | "archived" | "dismissed";
```

---

## Dependencies

One new package: `@uiw/react-md-editor`

```bash
pnpm add @uiw/react-md-editor
```

No other new dependencies. All other components use existing shadcn/ui.

---

## Testing

- `tests/app/admin/` — admin route protection (middleware redirects non-admin)
- `tests/components/admin/moderation-table.test.tsx` — bulk select, approve, reject
- `tests/components/admin/tutorial-editor.test.tsx` — file upload, editor content, responsive mode
- API route tests for all `/api/admin/*` endpoints (auth check, correct DB updates)
