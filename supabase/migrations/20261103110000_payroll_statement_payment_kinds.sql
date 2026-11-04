-- A single month can have a regular payment plus 13th salary, vacation pay or an adjustment.
-- Keep the recorded payslip as the source of truth and preserve one record per payment type.
alter table public.payroll_statements
  add column if not exists statement_kind text not null default 'ordinary'
    check (statement_kind in ('ordinary', 'thirteenth_advance', 'thirteenth_balance', 'vacation', 'adjustment')),
  add column if not exists paid_on date;

alter table public.payroll_statements
  drop constraint if exists payroll_statements_payroll_profile_id_statement_month_key;

create unique index if not exists payroll_statements_profile_month_kind_key
  on public.payroll_statements (payroll_profile_id, statement_month, statement_kind);
