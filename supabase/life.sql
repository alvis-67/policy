-- Professional life-needs worksheet for each client.
-- Safe to run more than once.

create table if not exists public.life_plans (
  client_id uuid primary key references public.clients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  funeral_cost numeric not null default 0 check (funeral_cost >= 0),
  sibling_count integer not null default 1 check (sibling_count between 1 and 20),
  inflation_rate numeric not null default 0,
  child_until integer not null default 22,
  parent_until integer not null default 88,
  reserve_amount numeric not null default 0,
  spouse_age integer,
  spouse_monthly numeric,
  spouse_until integer,
  members jsonb not null default '[]'::jsonb,
  debts jsonb not null default '[]'::jsonb,
  assets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists life_plans_user_idx on public.life_plans (user_id);

alter table public.life_plans add column if not exists inflation_rate numeric not null default 0;
alter table public.life_plans drop constraint if exists life_plans_inflation_rate_check;
alter table public.life_plans add constraint life_plans_inflation_rate_check
  check (inflation_rate >= 0 and inflation_rate <= 20);

alter table public.life_plans add column if not exists child_until integer not null default 22;
alter table public.life_plans add column if not exists parent_until integer not null default 88;
alter table public.life_plans add column if not exists reserve_amount numeric not null default 0;
alter table public.life_plans add column if not exists spouse_age integer;
alter table public.life_plans add column if not exists spouse_monthly numeric;
alter table public.life_plans add column if not exists spouse_until integer;

alter table public.life_plans drop constraint if exists life_plans_child_until_check;
alter table public.life_plans add constraint life_plans_child_until_check check (child_until between 1 and 40);
alter table public.life_plans drop constraint if exists life_plans_parent_until_check;
alter table public.life_plans add constraint life_plans_parent_until_check check (parent_until between 50 and 120);
alter table public.life_plans drop constraint if exists life_plans_reserve_amount_check;
alter table public.life_plans add constraint life_plans_reserve_amount_check check (reserve_amount >= 0);
alter table public.life_plans drop constraint if exists life_plans_spouse_age_check;
alter table public.life_plans add constraint life_plans_spouse_age_check check (spouse_age is null or spouse_age between 0 and 120);
alter table public.life_plans drop constraint if exists life_plans_spouse_monthly_check;
alter table public.life_plans add constraint life_plans_spouse_monthly_check check (spouse_monthly is null or spouse_monthly >= 0);
alter table public.life_plans drop constraint if exists life_plans_spouse_until_check;
alter table public.life_plans add constraint life_plans_spouse_until_check check (spouse_until is null or spouse_until between 1 and 120);

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
