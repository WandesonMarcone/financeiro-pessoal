-- Fase 2: identidade e associação familiar. Executar por migração privilegiada no Supabase.
-- Sem políticas de escrita de famílias/membros: provisionamento administrativo fechado.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.memberships (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('member','manager')),
  status text not null check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index memberships_user_status_idx on public.memberships(user_id, status);

-- Função sem acesso pelo cliente; RLS a chama para evitar recursão em memberships.
create function app_private.is_active_member(target_household uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.memberships m
    where m.household_id = target_household
      and m.user_id = auth.uid() and m.status = 'active'
  );
$$;
revoke all on function app_private.is_active_member(uuid) from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_active_member(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;

create policy households_read_member on public.households
for select to authenticated using (app_private.is_active_member(id));

create policy profiles_read_self on public.profiles
for select to authenticated using (user_id = (select auth.uid()) and exists (select 1 from public.memberships m where m.user_id = (select auth.uid()) and m.status = 'active'));
create policy profiles_insert_self on public.profiles
for insert to authenticated with check (user_id = (select auth.uid())
  and exists (select 1 from public.memberships m where m.user_id = (select auth.uid()) and m.status = 'active'));
create policy profiles_update_self on public.profiles
for update to authenticated using (user_id = (select auth.uid()) and exists (select 1 from public.memberships m where m.user_id = (select auth.uid()) and m.status = 'active'))
with check (user_id = (select auth.uid()) and exists (select 1 from public.memberships m where m.user_id = (select auth.uid()) and m.status = 'active'));

create policy memberships_read_own on public.memberships
for select to authenticated using (user_id = (select auth.uid()) and status = 'active');

-- Permissões explícitas da API. Nenhuma escrita de households/memberships pelo cliente.
revoke all on public.households, public.profiles, public.memberships from anon, authenticated;
grant select on public.households to authenticated;
grant select, insert, update (display_name) on public.profiles to authenticated;
grant select on public.memberships to authenticated;

