-- Contas mensais podem ter valor fixo ou valor informado a cada competência.
alter table public.recurring_rules
  alter column amount_cents drop not null,
  add column value_mode text not null default 'fixed' check(value_mode in ('fixed','variable')),
  add column duration_months integer check(duration_months is null or duration_months between 1 and 600);

alter table public.recurring_rules
  add constraint recurring_rule_value_mode_amount
  check (
    (value_mode='fixed' and amount_cents is not null and amount_cents > 0)
    or value_mode='variable'
  );
