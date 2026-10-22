-- Medical policies record the room level instead of a sum assured.
-- Safe to run more than once.

alter table public.policies alter column sum_assured drop not null;

alter table public.policies add column if not exists room_level text;
alter table public.policies add column if not exists deductible numeric;
alter table public.policies add column if not exists full_cover boolean;

alter table public.policies drop constraint if exists policies_room_level_check;
alter table public.policies add constraint policies_room_level_check
  check (room_level is null or room_level in ('ward', 'semi', 'private'));

alter table public.policies drop constraint if exists policies_deductible_check;
alter table public.policies add constraint policies_deductible_check
  check (deductible is null or deductible >= 0);
