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
