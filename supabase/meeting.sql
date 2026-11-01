-- Policy control columns and one saved Manulife quote per client.
-- Safe to run more than once. Paste this into the Supabase SQL editor.

alter table public.policies add column if not exists owner_name text not null default '';
alter table public.policies add column if not exists beneficiary text not null default '';
alter table public.policies add column if not exists premium_until date;
alter table public.policies add column if not exists client_notes text not null default '';

create table if not exists public.life_quotes (
  client_id uuid primary key references public.clients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  smoker boolean not null default false,
  pay_term text not null default '10' check (pay_term in ('5', '10', '20', '25', 'single')),
  annual_budget numeric check (annual_budget is null or annual_budget >= 0),
  hkd_gap numeric not null default 0 check (hkd_gap >= 0),
  age integer check (age is null or age between 0 and 120),
  sex text not null default '' check (sex in ('', 'male', 'female')),
  slip jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists life_quotes_user_idx on public.life_quotes (user_id);

drop trigger if exists life_quotes_touch on public.life_quotes;
create trigger life_quotes_touch
before insert or update on public.life_quotes
for each row execute function public.touch_owner();

alter table public.life_quotes enable row level security;

drop policy if exists "own life quotes" on public.life_quotes;
create policy "own life quotes" on public.life_quotes
for all to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.clients
    where clients.id = client_id and clients.user_id = auth.uid()
  )
);

revoke all on table public.life_quotes from anon, public;
grant select, insert, update, delete on table public.life_quotes to authenticated;
