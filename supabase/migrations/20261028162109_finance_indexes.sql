-- Índices de apoio a chaves estrangeiras e aos caminhos de autorização.
create index accounts_household_idx on public.accounts(household_id);
create index cards_household_idx on public.cards(household_id);
create index assets_owner_idx on public.assets(owner_user_id);
create index budgets_owner_idx on public.budgets(owner_user_id);
create index categories_owner_idx on public.categories(owner_user_id);
create index documents_owner_idx on public.documents(owner_user_id);
create index documents_transaction_idx on public.documents(transaction_id) where transaction_id is not null;
create index due_items_owner_idx on public.due_items(owner_user_id);
create index finance_operations_result_idx on public.finance_operations(result_id);
create index goal_contributions_goal_idx on public.goal_contributions(goal_id);
create index goal_contributions_owner_idx on public.goal_contributions(owner_user_id);
create index goals_owner_idx on public.goals(owner_user_id);
create index receipt_items_document_idx on public.receipt_items(document_id);
create index receipt_items_owner_idx on public.receipt_items(owner_user_id);
create index recurring_rules_owner_idx on public.recurring_rules(owner_user_id);
create index shopping_items_owner_idx on public.shopping_items(owner_user_id);
