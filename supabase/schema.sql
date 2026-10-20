-- Private policy book. Each signed-in account only sees its own rows.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chinese_name text not null default '',
  english_name text not null default '',
  gender text not null default '' check (gender in ('', 'male', 'female')),
  date_of_birth date,
  phone text not null,
  email text not null default '',
  hkid text not null default '',
  occupation text not null default '',
  marital_status text not null default '' check (marital_status in ('', 'single', 'married', 'divorced', 'widowed')),
  dependents integer check (dependents is null or (dependents >= 0 and dependents <= 30)),
  monthly_income numeric check (monthly_income is null or monthly_income >= 0),
  address text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(chinese_name) > 0 or char_length(english_name) > 0)
);

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  insurer text not null,
  policy_name text not null,
  policy_number text not null default '',
  policy_type text not null check (policy_type in ('life', 'critical', 'medical', 'accident', 'savings', 'ilas', 'annuity', 'other')),
  currency text not null check (currency in ('HKD', 'USD', 'CNY')),
  sum_assured numeric not null check (sum_assured >= 0),
  issue_date date not null,
  premium_amount numeric not null check (premium_amount >= 0),
  premium_frequency text not null check (premium_frequency in ('monthly', 'yearly')),
  premium_term text not null default '',
  status text not null check (status in ('inforce', 'paidup', 'lapsed', 'surrendered')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_user_updated_idx on public.clients (user_id, updated_at desc);
create index if not exists policies_user_idx on public.policies (user_id);
create index if not exists policies_client_idx on public.policies (client_id);

create or replace function public.touch_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists clients_touch on public.clients;
create trigger clients_touch
before insert or update on public.clients
for each row execute function public.touch_owner();

drop trigger if exists policies_touch on public.policies;
create trigger policies_touch
before insert or update on public.policies
for each row execute function public.touch_owner();

alter table public.clients enable row level security;
alter table public.policies enable row level security;

drop policy if exists "own clients" on public.clients;
create policy "own clients" on public.clients
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "own policies" on public.policies;
create policy "own policies" on public.policies
for all to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.clients
    where clients.id = client_id and clients.user_id = auth.uid()
  )
);

revoke all on table public.clients from anon, public;
revoke all on table public.policies from anon, public;
grant select, insert, update, delete on table public.clients to authenticated;
grant select, insert, update, delete on table public.policies to authenticated;

revoke all on function public.touch_owner() from public, anon;
grant execute on function public.touch_owner() to authenticated;
