-- Professional life-needs worksheet for each client.
-- Safe to run more than once.

create table if not exists public.life_plans (
  client_id uuid primary key references public.clients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  funeral_cost numeric not null default 0 check (funeral_cost >= 0),
  sibling_count integer not null default 1 check (sibling_count between 1 and 20),
  members jsonb not null default '[]'::jsonb,
  debts jsonb not null default '[]'::jsonb,
  assets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists life_plans_user_idx on public.life_plans (user_id);

drop trigger if exists life_plans_touch on public.life_plans;
create trigger life_plans_touch
before insert or update on public.life_plans
for each row execute function public.touch_owner();

alter table public.life_plans enable row level security;

drop policy if exists "own life plans" on public.life_plans;
create policy "own life plans" on public.life_plans
for all to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.clients
    where clients.id = client_id and clients.user_id = auth.uid()
  )
);

revoke all on table public.life_plans from anon, public;
grant select, insert, update, delete on table public.life_plans to authenticated;
