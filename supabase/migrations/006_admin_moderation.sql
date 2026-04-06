-- Add status column to news_items
alter table public.news_items
  add column status text not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));

create index news_items_status_idx on public.news_items(status);

-- Backfill existing rows to approved so they remain visible
update public.news_items set status = 'approved' where status = 'pending';

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
