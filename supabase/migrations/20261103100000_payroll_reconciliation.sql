-- Contracheques detalhados e conferência de obrigações médicas/financeiras.
-- Dados reais são lançados pelo usuário; nenhuma cobrança bancária é criada automaticamente.

create table public.commitments(
  id uuid primary key,
  household_id uuid not null references public.households(id),
  owner_user_id uuid not null default auth.uid() references auth.users(id),
  scope text not null default 'family' check(scope in ('personal','family')),
  archived boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check(length(trim(name)) between 1 and 180),
  kind text not null check(kind in ('medical','loan','other')),
  payment_channel text not null check(payment_channel in ('payroll','account_auto','manual')),
  total_cents bigint check(total_cents > 0 and total_cents <= 1000000000000),
  notes text not null default '' check(length(notes) <= 1500)
);

create table public.payroll_statements(
  id uuid primary key,
  household_id uuid not null references public.households(id),
  owner_user_id uuid not null default auth.uid() references auth.users(id),
  scope text not null default 'family' check(scope in ('personal','family')),
  archived boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payroll_profile_id uuid not null references public.payroll_profiles(id),
  statement_month date not null,
  gross_cents bigint not null check(gross_cents >= 0 and gross_cents <= 1000000000000),
  deductions_cents bigint not null check(deductions_cents >= 0 and deductions_cents <= 1000000000000),
  net_cents bigint not null check(net_cents >= 0 and net_cents <= 1000000000000),
  notes text not null default '' check(length(notes) <= 1500),
  unique(payroll_profile_id,statement_month)
);

create table public.payroll_statement_items(
  id uuid primary key,
  household_id uuid not null references public.households(id),
  owner_user_id uuid not null default auth.uid() references auth.users(id),
  scope text not null default 'family' check(scope in ('personal','family')),
  archived boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payroll_statement_id uuid not null references public.payroll_statements(id),
  commitment_id uuid references public.commitments(id),
  kind text not null check(kind in ('income','deduction')),
  code text not null default '' check(length(code) <= 40),
  description text not null check(length(trim(description)) between 1 and 220),
  category text not null check(category in ('salary','medical','military_contribution','tax','other')),
  amount_cents bigint not null check(amount_cents > 0 and amount_cents <= 1000000000000)
);

create table public.commitment_occurrences(
  id uuid primary key,
  household_id uuid not null references public.households(id),
  owner_user_id uuid not null default auth.uid() references auth.users(id),
  scope text not null default 'family' check(scope in ('personal','family')),
  archived boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  commitment_id uuid not null references public.commitments(id),
  expected_on date not null,
  expected_cents bigint not null check(expected_cents > 0 and expected_cents <= 1000000000000),
  actual_cents bigint check(actual_cents > 0 and actual_cents <= 1000000000000),
  actual_on date,
  notes text not null default '' check(length(notes) <= 1000),
  check((actual_cents is null and actual_on is null) or (actual_cents is not null and actual_on is not null))
);

alter table public.commitments enable row level security;
create policy commitments_read on public.commitments for select to authenticated using (app_private.can_read(household_id,owner_user_id,scope));
create policy commitments_insert on public.commitments for insert to authenticated with check (owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and version=1);
create policy commitments_update on public.commitments for update to authenticated using (owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)) with check (owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id));
create trigger commitments_guard before update on public.commitments for each row execute function app_private.guard_resource();
revoke all on public.commitments from anon,authenticated;
grant select,insert,update on public.commitments to authenticated;

alter table public.payroll_statements enable row level security;
create policy payroll_statements_read on public.payroll_statements for select to authenticated using (app_private.can_read(household_id,owner_user_id,scope));
create policy payroll_statements_insert on public.payroll_statements for insert to authenticated with check (owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and version=1 and exists(select 1 from public.payroll_profiles p where p.id=payroll_profile_id and p.household_id=household_id and p.owner_user_id=(select auth.uid()) and not p.archived));
create policy payroll_statements_update on public.payroll_statements for update to authenticated using (owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)) with check (owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and exists(select 1 from public.payroll_profiles p where p.id=payroll_profile_id and p.household_id=household_id and p.owner_user_id=(select auth.uid()) and not p.archived));
create trigger payroll_statements_guard before update on public.payroll_statements for each row execute function app_private.guard_resource();
revoke all on public.payroll_statements from anon,authenticated;
grant select,insert,update on public.payroll_statements to authenticated;

alter table public.payroll_statement_items enable row level security;
create policy payroll_statement_items_read on public.payroll_statement_items for select to authenticated using (app_private.can_read(household_id,owner_user_id,scope));
create policy payroll_statement_items_insert on public.payroll_statement_items for insert to authenticated with check (owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and version=1 and exists(select 1 from public.payroll_statements s where s.id=payroll_statement_id and s.household_id=household_id and s.owner_user_id=(select auth.uid()) and not s.archived) and (commitment_id is null or exists(select 1 from public.commitments c where c.id=commitment_id and c.household_id=household_id and c.owner_user_id=(select auth.uid()) and not c.archived)));
create policy payroll_statement_items_update on public.payroll_statement_items for update to authenticated using (owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)) with check (owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and exists(select 1 from public.payroll_statements s where s.id=payroll_statement_id and s.household_id=household_id and s.owner_user_id=(select auth.uid()) and not s.archived) and (commitment_id is null or exists(select 1 from public.commitments c where c.id=commitment_id and c.household_id=household_id and c.owner_user_id=(select auth.uid()) and not c.archived)));
create trigger payroll_statement_items_guard before update on public.payroll_statement_items for each row execute function app_private.guard_resource();
revoke all on public.payroll_statement_items from anon,authenticated;
grant select,insert,update on public.payroll_statement_items to authenticated;

alter table public.commitment_occurrences enable row level security;
create policy commitment_occurrences_read on public.commitment_occurrences for select to authenticated using (app_private.can_read(household_id,owner_user_id,scope));
create policy commitment_occurrences_insert on public.commitment_occurrences for insert to authenticated with check (owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and version=1 and exists(select 1 from public.commitments c where c.id=commitment_id and c.household_id=household_id and c.owner_user_id=(select auth.uid()) and not c.archived));
create policy commitment_occurrences_update on public.commitment_occurrences for update to authenticated using (owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)) with check (owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and exists(select 1 from public.commitments c where c.id=commitment_id and c.household_id=household_id and c.owner_user_id=(select auth.uid()) and not c.archived));
create trigger commitment_occurrences_guard before update on public.commitment_occurrences for each row execute function app_private.guard_resource();
revoke all on public.commitment_occurrences from anon,authenticated;
grant select,insert,update on public.commitment_occurrences to authenticated;

create index commitments_household_owner on public.commitments(household_id,owner_user_id);
create index payroll_statements_profile_month on public.payroll_statements(payroll_profile_id,statement_month);
create index payroll_statement_items_statement on public.payroll_statement_items(payroll_statement_id);
create index payroll_statement_items_commitment on public.payroll_statement_items(commitment_id) where commitment_id is not null;
create index commitment_occurrences_commitment_date on public.commitment_occurrences(commitment_id,expected_on);
