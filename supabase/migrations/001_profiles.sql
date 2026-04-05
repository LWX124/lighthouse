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
