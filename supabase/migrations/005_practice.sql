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
