-- Metas com projeção de rendimento e planejamento de contracheque.
-- Não integra contas bancárias: rendimentos e saldos informados são estimativas/reconciliações manuais.

alter table public.goals
  add column if not exists goal_kind text not null default 'standard'
    check (goal_kind in ('standard','yielding')),
  add column if not exists yield_source text not null default ''
    check (length(yield_source) <= 100),
  add column if not exists cdi_percent numeric(7,2) not null default 0
    check (cdi_percent >= 0 and cdi_percent <= 500),
  add column if not exists cdi_annual_percent numeric(7,3) not null default 0
    check (cdi_annual_percent >= 0 and cdi_annual_percent <= 100),
  add column if not exists reported_balance_cents bigint
    check (reported_balance_cents >= 0 and reported_balance_cents <= 1000000000000),
  add column if not exists reported_balance_on date;

create table if not exists public.payroll_profiles(
  id uuid primary key,
  household_id uuid not null references public.households(id),
  owner_user_id uuid not null default auth.uid() references auth.users(id),
  scope text not null default 'family' check(scope in ('personal','family')),
  archived boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check(length(trim(name)) between 1 and 100),
  gross_cents bigint not null check(gross_cents > 0 and gross_cents <= 1000000000000),
  payday_day integer not null check(payday_day between 1 and 31),
  notes text not null default '' check(length(notes) <= 1000)
);

create table if not exists public.payroll_deductions(
  id uuid primary key,
  household_id uuid not null references public.households(id),
  owner_user_id uuid not null default auth.uid() references auth.users(id),
  scope text not null default 'family' check(scope in ('personal','family')),
  archived boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payroll_profile_id uuid not null references public.payroll_profiles(id),
  kind text not null check(kind in ('loan','health','fixed','other')),
  description text not null check(length(trim(description)) between 1 and 180),
  amount_cents bigint not null check(amount_cents > 0 and amount_cents <= 1000000000000),
  expected_on date not null,
  recurrence text not null default 'once' check(recurrence in ('once','monthly')),
  end_on date,
  settled_on date,
  notes text not null default '' check(length(notes) <= 1000),
  check(end_on is null or end_on >= expected_on)
);

alter table public.payroll_profiles enable row level security;
create policy payroll_profiles_read on public.payroll_profiles for select to authenticated
  using (app_private.can_read(household_id,owner_user_id,scope));
create policy payroll_profiles_insert on public.payroll_profiles for insert to authenticated
  with check (owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and version=1);
create policy payroll_profiles_update on public.payroll_profiles for update to authenticated
  using (owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id))
  with check (owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id));
create trigger payroll_profiles_guard before update on public.payroll_profiles
  for each row execute function app_private.guard_resource();
revoke all on public.payroll_profiles from anon,authenticated;
grant select,insert,update on public.payroll_profiles to authenticated;

alter table public.payroll_deductions enable row level security;
create policy payroll_deductions_read on public.payroll_deductions for select to authenticated
  using (app_private.can_read(household_id,owner_user_id,scope));
create policy payroll_deductions_insert on public.payroll_deductions for insert to authenticated
  with check (
    owner_user_id=(select auth.uid())
    and app_private.is_active_member(household_id)
    and version=1
    and exists(select 1 from public.payroll_profiles p where p.id=payroll_profile_id and p.household_id=household_id and p.owner_user_id=(select auth.uid()) and not p.archived)
  );
create policy payroll_deductions_update on public.payroll_deductions for update to authenticated
  using (owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id))
  with check (
    owner_user_id=(select auth.uid())
    and app_private.is_active_member(household_id)
    and exists(select 1 from public.payroll_profiles p where p.id=payroll_profile_id and p.household_id=household_id and p.owner_user_id=(select auth.uid()) and not p.archived)
  );
create trigger payroll_deductions_guard before update on public.payroll_deductions
  for each row execute function app_private.guard_resource();
revoke all on public.payroll_deductions from anon,authenticated;
grant select,insert,update on public.payroll_deductions to authenticated;
create index if not exists payroll_profiles_household_owner on public.payroll_profiles(household_id,owner_user_id);
create index if not exists payroll_deductions_profile_date on public.payroll_deductions(payroll_profile_id,expected_on);
