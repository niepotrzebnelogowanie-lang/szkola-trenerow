-- Szkoła trenerów: one private JSON workspace per authenticated user.
-- Run this entire script in the Supabase SQL Editor.
create table if not exists public.user_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_workspaces enable row level security;

revoke all on table public.user_workspaces from anon;
grant select, insert, update, delete on table public.user_workspaces to authenticated;

drop policy if exists "Users can read own workspace" on public.user_workspaces;
create policy "Users can read own workspace"
  on public.user_workspaces for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own workspace" on public.user_workspaces;
create policy "Users can insert own workspace"
  on public.user_workspaces for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own workspace" on public.user_workspaces;
create policy "Users can update own workspace"
  on public.user_workspaces for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own workspace" on public.user_workspaces;
create policy "Users can delete own workspace"
  on public.user_workspaces for delete to authenticated
  using ((select auth.uid()) = user_id);
