-- Names used by the new-policy menu. Safe to run more than once.

create table if not exists public.insurers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.policy_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  insurer_id uuid not null references public.insurers (id) on delete cascade,
  policy_type text not null check (policy_type in ('life', 'critical', 'medical', 'accident', 'savings', 'ilas', 'annuity', 'other')),
  name text not null check (char_length(name) between 1 and 80),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, insurer_id, policy_type, name)
);

create index if not exists insurers_user_sort_idx on public.insurers (user_id, sort_order);
create index if not exists policy_products_insurer_idx on public.policy_products (insurer_id, policy_type, sort_order);

drop trigger if exists insurers_touch on public.insurers;
create trigger insurers_touch
before insert or update on public.insurers
for each row execute function public.touch_owner();

drop trigger if exists policy_products_touch on public.policy_products;
create trigger policy_products_touch
before insert or update on public.policy_products
for each row execute function public.touch_owner();

alter table public.insurers enable row level security;
alter table public.policy_products enable row level security;

drop policy if exists "own insurers" on public.insurers;
create policy "own insurers" on public.insurers
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "own policy products" on public.policy_products;
create policy "own policy products" on public.policy_products
for all to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.insurers
    where insurers.id = insurer_id and insurers.user_id = auth.uid()
  )
);

revoke all on table public.insurers from anon, public;
revoke all on table public.policy_products from anon, public;
grant select, insert, update, delete on table public.insurers to authenticated;
grant select, insert, update, delete on table public.policy_products to authenticated;
