-- Manulife brochure and premium files. Safe to run more than once.

create table if not exists public.manulife_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_name text not null check (char_length(product_name) between 1 and 80),
  policy_type text not null check (policy_type in ('life', 'critical', 'medical', 'accident', 'savings', 'ilas', 'annuity', 'other')),
  file_kind text not null check (file_kind in ('brochure', 'premium')),
  file_name text not null check (char_length(file_name) between 1 and 180),
  storage_path text not null check (char_length(storage_path) between 1 and 300),
  premium_amount numeric check (premium_amount is null or premium_amount >= 0),
  premium_note text not null default '' check (char_length(premium_note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manulife_documents_user_idx on public.manulife_documents (user_id, created_at desc);

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

revoke all on function public.touch_owner() from public, anon;
grant execute on function public.touch_owner() to authenticated;

drop trigger if exists manulife_documents_touch on public.manulife_documents;
create trigger manulife_documents_touch
before insert or update on public.manulife_documents
for each row execute function public.touch_owner();

alter table public.manulife_documents enable row level security;

drop policy if exists "own manulife documents" on public.manulife_documents;
create policy "own manulife documents" on public.manulife_documents
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

revoke all on table public.manulife_documents from anon, public;
grant select, insert, update, delete on table public.manulife_documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('product-files', 'product-files', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "own product files" on storage.objects;
create policy "own product files" on storage.objects
for all to authenticated
using (
  bucket_id = 'product-files'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'product-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);
