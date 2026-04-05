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
