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
