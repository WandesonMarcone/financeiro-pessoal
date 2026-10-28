-- Financeiro: escritas monetárias atômicas e idempotentes.
create function app_private.can_read(h uuid, o uuid, s text)
returns boolean language sql stable security definer set search_path=''
as $$ select auth.uid() is not null and app_private.is_active_member(h) and (s='family' or o=auth.uid()) $$;
revoke all on function app_private.can_read(uuid,uuid,text) from public,anon;
grant execute on function app_private.can_read(uuid,uuid,text) to authenticated;

create table public.accounts(
 id uuid primary key, household_id uuid not null references public.households(id),
 owner_user_id uuid not null default auth.uid() references auth.users(id),
 name text not null check(length(trim(name)) between 1 and 100),
 opening_cents bigint not null default 0 check(abs(opening_cents)<=1000000000000),
 archived boolean not null default false, version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.cards(
 id uuid primary key, household_id uuid not null references public.households(id),
 owner_user_id uuid not null default auth.uid() references auth.users(id),
 name text not null check(length(trim(name)) between 1 and 100),
 limit_cents bigint not null check(limit_cents>0 and limit_cents<=1000000000000),
 closing_day int not null check(closing_day between 1 and 31),
 due_day int not null check(due_day between 1 and 31),
 archived boolean not null default false, version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.transactions(
 id uuid primary key, household_id uuid not null references public.households(id),
 owner_user_id uuid not null references auth.users(id), scope text not null check(scope in ('personal','family')),
 kind text not null check(kind in ('income','expense','transfer','card_payment')),
 description text not null check(length(trim(description)) between 1 and 250),
 amount_cents bigint not null check(amount_cents>0 and amount_cents<=1000000000000),
 occurred_on date not null, category text not null default 'Outros', merchant text not null default '',
 method text not null check(method in ('account','card','untracked')),
 status text not null default 'posted' check(status in ('posted','void')),
 version int not null default 1, created_at timestamptz not null default now(),
 check(kind='expense' or scope='personal'));
create table public.ledger_entries(
 id uuid primary key default gen_random_uuid(), transaction_id uuid not null references public.transactions(id),
 account_id uuid not null references public.accounts(id), amount_cents bigint not null,
 created_at timestamptz not null default now());
create table public.card_installments(
 id uuid primary key default gen_random_uuid(), transaction_id uuid not null references public.transactions(id),
 card_id uuid not null references public.cards(id), number int not null, due_on date not null,
 amount_cents bigint not null check(amount_cents>0), unique(transaction_id,number));
create table public.invoice_payments(
 transaction_id uuid primary key references public.transactions(id), card_id uuid not null references public.cards(id),
 due_on date not null, amount_cents bigint not null check(amount_cents>0));
create table public.finance_operations(
 user_id uuid not null references auth.users(id), id uuid not null, payload jsonb not null,
 result_id uuid not null references public.transactions(id), created_at timestamptz not null default now(),
 primary key(user_id,id));
create table public.audit_events(
 id uuid primary key default gen_random_uuid(), household_id uuid not null, owner_user_id uuid not null,
 entity_id uuid not null, action text not null, details jsonb not null, created_at timestamptz not null default now());
create index transactions_household_date on public.transactions(household_id,occurred_on);
create index transactions_owner on public.transactions(owner_user_id);
create index ledger_account on public.ledger_entries(account_id);
create index ledger_transaction on public.ledger_entries(transaction_id);
create index installments_card_due on public.card_installments(card_id,due_on);
create index payments_card_due on public.invoice_payments(card_id,due_on);
create index accounts_owner on public.accounts(owner_user_id);
create index cards_owner on public.cards(owner_user_id);

-- Protege autoria, família e versão de cadastros editáveis.
create function app_private.guard_resource() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.household_id<>old.household_id or new.owner_user_id<>old.owner_user_id or new.created_at<>old.created_at then
  raise exception 'Identidade do registro imutável' using errcode='42501';
 end if;
 new.version:=old.version+1; new.updated_at:=now(); return new;
end $$;
revoke all on function app_private.guard_resource() from public,anon,authenticated;

create function app_private.month_day(m date,d int) returns date language sql immutable set search_path='' as $$
select date_trunc('month',m)::date + (least(d,extract(day from (date_trunc('month',m)+interval '1 month - 1 day'))::int)-1)
$$;
revoke all on function app_private.month_day(date,int) from public,anon,authenticated;

create function public.post_transaction(operation_id uuid, payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); h uuid; k text; s text; amt bigint; dt date; source uuid; target uuid; card uuid;
 oldop public.finance_operations%rowtype; tx public.transactions%rowtype; c public.cards%rowtype;
 n int; i int; due_item record; first_due date; closing date; due date; base bigint; remainder bigint; owed bigint;
begin
 if actor is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||operation_id::text,0));
 select * into oldop from public.finance_operations where user_id=actor and id=operation_id;
 if found then
  if oldop.payload<>payload then raise exception 'Identificador já usado com outro conteúdo' using errcode='23505'; end if;
  if not exists(select 1 from public.transactions t where t.id=oldop.result_id and app_private.is_active_member(t.household_id)) then raise exception 'Acesso revogado' using errcode='42501'; end if;
  return oldop.result_id;
 end if;
 h:=(payload->>'household_id')::uuid;
 if not app_private.is_active_member(h) then raise exception 'Família não autorizada' using errcode='42501'; end if;
 if payload->>'action'='void' then
  select * into tx from public.transactions where id=(payload->>'transaction_id')::uuid for update;
  if not found or tx.owner_user_id<>actor or tx.household_id<>h then raise exception 'Lançamento não autorizado' using errcode='42501'; end if;
  if tx.version<>(payload->>'version')::int or tx.status<>'posted' then raise exception 'Conflito: lançamento já alterado' using errcode='40001'; end if;
  perform 1 from public.cards where id in (select card_id from public.card_installments where transaction_id=tx.id union select card_id from public.invoice_payments where transaction_id=tx.id) for update;
  -- Evita reverter compras com faturas já pagas, exigindo revisão explícita.
  if exists(select 1 from public.card_installments i join public.invoice_payments p on p.card_id=i.card_id and p.due_on=i.due_on join public.transactions pt on pt.id=p.transaction_id and pt.status='posted' where i.transaction_id=tx.id) then raise exception 'Reverta primeiro os pagamentos das faturas envolvidas'; end if;
  update public.transactions set status='void',version=version+1 where id=tx.id;
  update public.due_items set paid_transaction_id=null where paid_transaction_id=tx.id;
  insert into public.audit_events(household_id,owner_user_id,entity_id,action,details) values(h,actor,tx.id,'void',jsonb_build_object('version',tx.version));
  insert into public.finance_operations values(actor,operation_id,payload,tx.id,now());
  return tx.id;
 end if;
 k:=payload->>'kind'; s:=coalesce(payload->>'scope','personal');
 amt:=(payload->>'amount_cents')::bigint;
 if amt is null or amt<=0 or amt>1000000000000 then raise exception 'Valor inválido'; end if;
 if coalesce(payload->>'occurred_on','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data inválida'; end if;
 dt:=(payload->>'occurred_on')::date;
 source:=nullif(payload->>'account_id','')::uuid; target:=nullif(payload->>'target_account_id','')::uuid; card:=nullif(payload->>'card_id','')::uuid;
 if k is null or k not in ('income','expense','transfer','card_payment') or s not in ('personal','family') or (k<>'expense' and s<>'personal') then raise exception 'Tipo ou escopo inválido'; end if;
 if source is not null and not exists(select 1 from public.accounts where id=source and owner_user_id=actor and household_id=h and not archived) then raise exception 'Conta não autorizada' using errcode='42501'; end if;
 if target is not null and not exists(select 1 from public.accounts where id=target and owner_user_id=actor and household_id=h and not archived) then raise exception 'Destino não autorizado' using errcode='42501'; end if;
 if card is not null then
  select * into c from public.cards where id=card and owner_user_id=actor and household_id=h and not archived for update;
  if not found then raise exception 'Cartão não autorizado' using errcode='42501'; end if;
 end if;
 if k='transfer' and (source is null or target is null or source=target or card is not null) then raise exception 'Transferência inválida'; end if;
 if k='income' and (source is null or card is not null or target is not null) then raise exception 'Receita exige conta'; end if;
 if k='expense' and (target is not null or (source is not null and card is not null)) then raise exception 'Origem inválida'; end if;
 if k='card_payment' then
  if card is null or source is null or target is not null then raise exception 'Pagamento exige cartão e conta'; end if;
  due:=(payload->>'due_on')::date;
  select coalesce(sum(i.amount_cents),0) into owed from public.card_installments i join public.transactions t on t.id=i.transaction_id where i.card_id=card and i.due_on=due and t.status='posted';
  owed:=owed-coalesce((select sum(p.amount_cents) from public.invoice_payments p join public.transactions t on t.id=p.transaction_id where p.card_id=card and p.due_on=due and t.status='posted'),0);
  if due is null or amt>owed then raise exception 'Pagamento excede saldo da fatura'; end if;
 end if;
 if k='expense' and card is not null then
  n:=coalesce((payload->>'installments')::int,1);
  if n<1 or n>120 or n>amt then raise exception 'Parcelamento inválido'; end if;
  select coalesce(sum(i.amount_cents),0) into owed from public.card_installments i join public.transactions t on t.id=i.transaction_id where i.card_id=card and t.status='posted';
  owed:=owed-coalesce((select sum(p.amount_cents) from public.invoice_payments p join public.transactions t on t.id=p.transaction_id where p.card_id=card and t.status='posted'),0);
  if owed+amt>c.limit_cents then raise exception 'Compra excede limite disponível'; end if;
 end if;
 if nullif(payload->>'due_item_id','') is not null then
  select * into due_item from public.due_items where id=(payload->>'due_item_id')::uuid for update;
  if not found or due_item.owner_user_id<>actor or due_item.household_id<>h or due_item.scope<>s or due_item.amount_cents<>amt or k<>'expense' or due_item.paid_transaction_id is not null or due_item.archived then raise exception 'Conta a pagar incompatível ou já paga' using errcode='40001'; end if;
 end if;
 insert into public.transactions(id,household_id,owner_user_id,scope,kind,description,amount_cents,occurred_on,category,merchant,method)
 values(operation_id,h,actor,s,k,trim(payload->>'description'),amt,dt,coalesce(nullif(payload->>'category',''),'Outros'),coalesce(payload->>'merchant',''),case when card is not null and k='expense' then 'card' when source is not null then 'account' else 'untracked' end);
 if source is not null then insert into public.ledger_entries(transaction_id,account_id,amount_cents) values(operation_id,source,case when k='income' then amt else -amt end); end if;
 if k='transfer' then insert into public.ledger_entries(transaction_id,account_id,amount_cents) values(operation_id,target,amt); end if;
 if k='card_payment' then insert into public.invoice_payments values(operation_id,card,due,amt); end if;
 if k='expense' and card is not null then
  closing:=app_private.month_day(dt,c.closing_day);
  if dt>=closing then closing:=app_private.month_day((date_trunc('month',dt)+interval '1 month')::date,c.closing_day); end if;
  first_due:=app_private.month_day(closing,c.due_day);
  if first_due<=closing then first_due:=app_private.month_day((date_trunc('month',closing)+interval '1 month')::date,c.due_day); end if;
  base:=amt/n; remainder:=amt%n;
  for i in 1..n loop
   insert into public.card_installments(transaction_id,card_id,number,due_on,amount_cents)
   values(operation_id,card,i,app_private.month_day((date_trunc('month',first_due)+(i-1)*interval '1 month')::date,c.due_day),base+case when i<=remainder then 1 else 0 end);
  end loop;
 end if;
 if nullif(payload->>'due_item_id','') is not null then update public.due_items set paid_transaction_id=operation_id where id=(payload->>'due_item_id')::uuid; end if;
 insert into public.finance_operations values(actor,operation_id,payload,operation_id,now());
 insert into public.audit_events(household_id,owner_user_id,entity_id,action,details) values(h,actor,operation_id,'created',jsonb_build_object('kind',k,'amount_cents',amt));
 return operation_id;
end $$;
revoke all on function public.post_transaction(uuid,jsonb) from public,anon;
grant execute on function public.post_transaction(uuid,jsonb) to authenticated;

-- O cliente lê movimentos; somente a função validada pode escrever.
alter table public.transactions enable row level security;
create policy transactions_read on public.transactions for select to authenticated using(app_private.can_read(household_id,owner_user_id,scope));
alter table public.ledger_entries enable row level security;
create policy ledger_read on public.ledger_entries for select to authenticated using(exists(select 1 from public.accounts a where a.id=account_id));
alter table public.card_installments enable row level security;
create policy installments_read on public.card_installments for select to authenticated using(exists(select 1 from public.cards c where c.id=card_id));
alter table public.invoice_payments enable row level security;
create policy payments_read on public.invoice_payments for select to authenticated using(exists(select 1 from public.cards c where c.id=card_id));
alter table public.finance_operations enable row level security;
create policy operations_read on public.finance_operations for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.memberships m where m.user_id=(select auth.uid()) and m.status='active'));
alter table public.audit_events enable row level security;
create policy audit_read on public.audit_events for select to authenticated using(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id));
revoke all on public.transactions,public.ledger_entries,public.card_installments,public.invoice_payments,public.finance_operations,public.audit_events from anon,authenticated;
grant select on public.transactions,public.ledger_entries,public.card_installments,public.invoice_payments,public.finance_operations,public.audit_events to authenticated;

-- Cadastros e módulos auxiliares, com versões para conflitos.
create table public.categories(id uuid primary key, household_id uuid not null references public.households(id), owner_user_id uuid not null default auth.uid() references auth.users(id), scope text not null default 'personal' check(scope in ('personal','family')), archived boolean not null default false, version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),name text not null check(length(trim(name)) between 1 and 100), parent_name text not null default '');
create table public.budgets(id uuid primary key, household_id uuid not null references public.households(id), owner_user_id uuid not null default auth.uid() references auth.users(id), scope text not null default 'personal' check(scope in ('personal','family')), archived boolean not null default false, version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),month date not null check(extract(day from month)=1), category text not null, limit_cents bigint not null check(limit_cents>0 and limit_cents<=1000000000000));
create table public.goals(id uuid primary key, household_id uuid not null references public.households(id), owner_user_id uuid not null default auth.uid() references auth.users(id), scope text not null default 'personal' check(scope in ('personal','family')), archived boolean not null default false, version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),name text not null check(length(trim(name)) between 1 and 150), target_cents bigint not null check(target_cents>0 and target_cents<=1000000000000), due_on date);
create table public.goal_contributions(id uuid primary key, household_id uuid not null references public.households(id), owner_user_id uuid not null default auth.uid() references auth.users(id), scope text not null default 'personal' check(scope in ('personal','family')), archived boolean not null default false, version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),goal_id uuid not null references public.goals(id), amount_cents bigint not null check(amount_cents>0 and amount_cents<=1000000000000), occurred_on date not null);
create table public.assets(id uuid primary key, household_id uuid not null references public.households(id), owner_user_id uuid not null default auth.uid() references auth.users(id), scope text not null default 'personal' check(scope in ('personal','family')), archived boolean not null default false, version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),name text not null check(length(trim(name)) between 1 and 150), value_cents bigint not null check(value_cents>=0 and value_cents<=1000000000000), acquired_on date, notes text not null default '');
create table public.shopping_items(id uuid primary key, household_id uuid not null references public.households(id), owner_user_id uuid not null default auth.uid() references auth.users(id), scope text not null default 'personal' check(scope in ('personal','family')), archived boolean not null default false, version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),name text not null check(length(trim(name)) between 1 and 150), quantity numeric(12,3) not null default 1 check(quantity>0), unit text not null default 'un', purchased boolean not null default false);
create table public.recurring_rules(id uuid primary key, household_id uuid not null references public.households(id), owner_user_id uuid not null default auth.uid() references auth.users(id), scope text not null default 'personal' check(scope in ('personal','family')), archived boolean not null default false, version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),description text not null, amount_cents bigint not null check(amount_cents>0 and amount_cents<=1000000000000), category text not null default 'Outros', day int not null check(day between 1 and 31), start_on date not null, end_on date);
create table public.due_items(id uuid primary key, household_id uuid not null references public.households(id), owner_user_id uuid not null default auth.uid() references auth.users(id), scope text not null default 'personal' check(scope in ('personal','family')), archived boolean not null default false, version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),description text not null, amount_cents bigint not null check(amount_cents>0 and amount_cents<=1000000000000), category text not null default 'Outros', due_on date not null, paid_transaction_id uuid references public.transactions(id), recurring_rule_id uuid references public.recurring_rules(id), unique(recurring_rule_id,due_on));
create table public.documents(id uuid primary key, household_id uuid not null references public.households(id), owner_user_id uuid not null default auth.uid() references auth.users(id), scope text not null default 'personal' check(scope in ('personal','family')), archived boolean not null default false, version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),filename text not null, mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf')), size_bytes bigint not null check(size_bytes>0 and size_bytes<=10485760), checksum text not null, transaction_id uuid references public.transactions(id), warranty_until date, notes text not null default '');
create table public.receipt_items(id uuid primary key, household_id uuid not null references public.households(id), owner_user_id uuid not null default auth.uid() references auth.users(id), scope text not null default 'personal' check(scope in ('personal','family')), archived boolean not null default false, version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),document_id uuid not null references public.documents(id), product_key text not null check(length(trim(product_key))>0), brand text not null default '', quantity numeric(12,4) not null check(quantity>0), unit text not null check(unit in ('un','kg','l')), total_cents bigint not null check(total_cents>0), merchant text not null default '', purchased_on date not null);
alter table public.accounts enable row level security;
create policy accounts_read on public.accounts for select to authenticated using((owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)));
create policy accounts_insert on public.accounts for insert to authenticated with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and version=1);
create policy accounts_update on public.accounts for update to authenticated using(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)) with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id));
create trigger accounts_guard before update on public.accounts for each row execute function app_private.guard_resource();
revoke all on public.accounts from anon,authenticated;
grant select,insert,update on public.accounts to authenticated;
alter table public.cards enable row level security;
create policy cards_read on public.cards for select to authenticated using((owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)));
create policy cards_insert on public.cards for insert to authenticated with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and version=1);
create policy cards_update on public.cards for update to authenticated using(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)) with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id));
create trigger cards_guard before update on public.cards for each row execute function app_private.guard_resource();
revoke all on public.cards from anon,authenticated;
grant select,insert,update on public.cards to authenticated;
alter table public.categories enable row level security;
create policy categories_read on public.categories for select to authenticated using(app_private.can_read(household_id,owner_user_id,scope));
create policy categories_insert on public.categories for insert to authenticated with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and version=1);
create policy categories_update on public.categories for update to authenticated using(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)) with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id));
create trigger categories_guard before update on public.categories for each row execute function app_private.guard_resource();
revoke all on public.categories from anon,authenticated;
grant select,insert,update on public.categories to authenticated;
create index categories_household_owner on public.categories(household_id,owner_user_id);
alter table public.budgets enable row level security;
create policy budgets_read on public.budgets for select to authenticated using(app_private.can_read(household_id,owner_user_id,scope));
create policy budgets_insert on public.budgets for insert to authenticated with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and version=1);
create policy budgets_update on public.budgets for update to authenticated using(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)) with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id));
create trigger budgets_guard before update on public.budgets for each row execute function app_private.guard_resource();
revoke all on public.budgets from anon,authenticated;
grant select,insert,update on public.budgets to authenticated;
create index budgets_household_owner on public.budgets(household_id,owner_user_id);
alter table public.goals enable row level security;
create policy goals_read on public.goals for select to authenticated using(app_private.can_read(household_id,owner_user_id,scope));
create policy goals_insert on public.goals for insert to authenticated with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and version=1);
create policy goals_update on public.goals for update to authenticated using(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)) with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id));
create trigger goals_guard before update on public.goals for each row execute function app_private.guard_resource();
revoke all on public.goals from anon,authenticated;
grant select,insert,update on public.goals to authenticated;
create index goals_household_owner on public.goals(household_id,owner_user_id);
alter table public.goal_contributions enable row level security;
create policy goal_contributions_read on public.goal_contributions for select to authenticated using(app_private.can_read(household_id,owner_user_id,scope));
create policy goal_contributions_insert on public.goal_contributions for insert to authenticated with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and version=1);
create policy goal_contributions_update on public.goal_contributions for update to authenticated using(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)) with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id));
create trigger goal_contributions_guard before update on public.goal_contributions for each row execute function app_private.guard_resource();
revoke all on public.goal_contributions from anon,authenticated;
grant select,insert,update on public.goal_contributions to authenticated;
create index goal_contributions_household_owner on public.goal_contributions(household_id,owner_user_id);
alter table public.assets enable row level security;
create policy assets_read on public.assets for select to authenticated using(app_private.can_read(household_id,owner_user_id,scope));
create policy assets_insert on public.assets for insert to authenticated with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and version=1);
create policy assets_update on public.assets for update to authenticated using(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)) with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id));
create trigger assets_guard before update on public.assets for each row execute function app_private.guard_resource();
revoke all on public.assets from anon,authenticated;
grant select,insert,update on public.assets to authenticated;
create index assets_household_owner on public.assets(household_id,owner_user_id);
alter table public.shopping_items enable row level security;
create policy shopping_items_read on public.shopping_items for select to authenticated using(app_private.can_read(household_id,owner_user_id,scope));
create policy shopping_items_insert on public.shopping_items for insert to authenticated with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and version=1);
create policy shopping_items_update on public.shopping_items for update to authenticated using(app_private.can_read(household_id,owner_user_id,scope)) with check(app_private.can_read(household_id,owner_user_id,scope));
create trigger shopping_items_guard before update on public.shopping_items for each row execute function app_private.guard_resource();
revoke all on public.shopping_items from anon,authenticated;
grant select,insert,update on public.shopping_items to authenticated;
create index shopping_items_household_owner on public.shopping_items(household_id,owner_user_id);
alter table public.recurring_rules enable row level security;
create policy recurring_rules_read on public.recurring_rules for select to authenticated using(app_private.can_read(household_id,owner_user_id,scope));
create policy recurring_rules_insert on public.recurring_rules for insert to authenticated with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and version=1);
create policy recurring_rules_update on public.recurring_rules for update to authenticated using(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)) with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id));
create trigger recurring_rules_guard before update on public.recurring_rules for each row execute function app_private.guard_resource();
revoke all on public.recurring_rules from anon,authenticated;
grant select,insert,update on public.recurring_rules to authenticated;
create index recurring_rules_household_owner on public.recurring_rules(household_id,owner_user_id);
alter table public.due_items enable row level security;
create policy due_items_read on public.due_items for select to authenticated using(app_private.can_read(household_id,owner_user_id,scope));
create policy due_items_insert on public.due_items for insert to authenticated with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and version=1);
create policy due_items_update on public.due_items for update to authenticated using(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)) with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id));
create trigger due_items_guard before update on public.due_items for each row execute function app_private.guard_resource();
revoke all on public.due_items from anon,authenticated;
grant select,insert,update on public.due_items to authenticated;
create index due_items_household_owner on public.due_items(household_id,owner_user_id);
alter table public.documents enable row level security;
create policy documents_read on public.documents for select to authenticated using(app_private.can_read(household_id,owner_user_id,scope));
create policy documents_insert on public.documents for insert to authenticated with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and version=1);
create policy documents_update on public.documents for update to authenticated using(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)) with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id));
create trigger documents_guard before update on public.documents for each row execute function app_private.guard_resource();
revoke all on public.documents from anon,authenticated;
grant select,insert,update on public.documents to authenticated;
create index documents_household_owner on public.documents(household_id,owner_user_id);
alter table public.receipt_items enable row level security;
create policy receipt_items_read on public.receipt_items for select to authenticated using(app_private.can_read(household_id,owner_user_id,scope));
create policy receipt_items_insert on public.receipt_items for insert to authenticated with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and version=1);
create policy receipt_items_update on public.receipt_items for update to authenticated using(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)) with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id));
create trigger receipt_items_guard before update on public.receipt_items for each row execute function app_private.guard_resource();
revoke all on public.receipt_items from anon,authenticated;
grant select,insert,update on public.receipt_items to authenticated;
create index receipt_items_household_owner on public.receipt_items(household_id,owner_user_id);

create function app_private.validate_parent() returns trigger language plpgsql set search_path='' as $$
declare h uuid; o uuid; s text;
begin
 if tg_table_name='goal_contributions' then
  select household_id,owner_user_id,scope into h,o,s from public.goals where id=new.goal_id;
 elsif tg_table_name='receipt_items' then
  select household_id,owner_user_id,scope into h,o,s from public.documents where id=new.document_id;
 elsif tg_table_name='documents' and new.transaction_id is not null then
  select household_id,owner_user_id,scope into h,o,s from public.transactions where id=new.transaction_id;
 elsif tg_table_name='due_items' then
  if new.paid_transaction_id is not null then
   select household_id,owner_user_id,scope into h,o,s from public.transactions where id=new.paid_transaction_id and kind='expense' and status='posted';
   if h is null or h<>new.household_id or o<>new.owner_user_id or s<>new.scope then raise exception 'Pagamento incompatível' using errcode='42501'; end if;
  end if;
  if new.recurring_rule_id is null then return new; end if;
  select household_id,owner_user_id,scope into h,o,s from public.recurring_rules where id=new.recurring_rule_id;
 else return new;
 end if;
 if h is null or h<>new.household_id or o<>new.owner_user_id or s<>new.scope then raise exception 'Registro relacionado incompatível' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function app_private.validate_parent() from public,anon,authenticated;
create trigger contribution_parent before insert or update on public.goal_contributions for each row execute function app_private.validate_parent();
create trigger receipt_parent before insert or update on public.receipt_items for each row execute function app_private.validate_parent();
create trigger document_parent before insert or update on public.documents for each row execute function app_private.validate_parent();
create trigger due_parent before insert or update on public.due_items for each row execute function app_private.validate_parent();

-- Auditoria de cadastros: somente o autor pode ler o histórico privado.
create function app_private.audit_resource() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_events(household_id,owner_user_id,entity_id,action,details)
 values(new.household_id,new.owner_user_id,new.id,tg_op||':'||tg_table_name,jsonb_build_object('before',case when tg_op='UPDATE' then to_jsonb(old) else null end,'after',to_jsonb(new),'actor',auth.uid()));
 return new;
end $$;
revoke all on function app_private.audit_resource() from public,anon,authenticated;
create trigger accounts_audit after insert or update on public.accounts for each row execute function app_private.audit_resource();
create trigger cards_audit after insert or update on public.cards for each row execute function app_private.audit_resource();
create trigger categories_audit after insert or update on public.categories for each row execute function app_private.audit_resource();
create trigger budgets_audit after insert or update on public.budgets for each row execute function app_private.audit_resource();
create trigger goals_audit after insert or update on public.goals for each row execute function app_private.audit_resource();
create trigger goal_contributions_audit after insert or update on public.goal_contributions for each row execute function app_private.audit_resource();
create trigger assets_audit after insert or update on public.assets for each row execute function app_private.audit_resource();
create trigger shopping_items_audit after insert or update on public.shopping_items for each row execute function app_private.audit_resource();
create trigger recurring_rules_audit after insert or update on public.recurring_rules for each row execute function app_private.audit_resource();
create trigger due_items_audit after insert or update on public.due_items for each row execute function app_private.audit_resource();
create trigger documents_audit after insert or update on public.documents for each row execute function app_private.audit_resource();
create trigger receipt_items_audit after insert or update on public.receipt_items for each row execute function app_private.audit_resource();

-- Objetos privados. O nome do objeto deve ser exatamente o UUID dos metadados autorizados.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('family-documents','family-documents',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy family_documents_read on storage.objects for select to authenticated using(
 bucket_id='family-documents' and exists(select 1 from public.documents d where d.id::text=name and not d.archived));
create policy family_documents_insert on storage.objects for insert to authenticated with check(
 bucket_id='family-documents' and exists(select 1 from public.documents d where d.id::text=name and d.owner_user_id=(select auth.uid()) and not d.archived));
-- Sem acesso público ou sobrescrita. Novas versões usam novos UUIDs.


create unique index due_paid_once on public.due_items(paid_transaction_id) where paid_transaction_id is not null;
-- Filhos deixam de ser visíveis quando o pai muda de escopo ou é arquivado.
create policy contribution_parent_visible on public.goal_contributions as restrictive for select to authenticated using(exists(select 1 from public.goals g where g.id=goal_id and not g.archived));
create policy receipt_parent_visible on public.receipt_items as restrictive for select to authenticated using(exists(select 1 from public.documents d where d.id=document_id and not d.archived));
create function app_private.guard_due_payment() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user='authenticated' and ((tg_op='INSERT' and new.paid_transaction_id is not null) or (tg_op='UPDATE' and new.paid_transaction_id is distinct from old.paid_transaction_id)) then raise exception 'Pagamento somente pelo lançamento atômico' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function app_private.guard_due_payment() from public,anon,authenticated;
create trigger due_payment_guard before insert or update on public.due_items for each row execute function app_private.guard_due_payment();
create unique index recurring_once_per_month on public.due_items(recurring_rule_id,(extract(year from due_on)),(extract(month from due_on))) where recurring_rule_id is not null;
alter table public.documents add column upload_status text not null default 'pending' check(upload_status in ('pending','ready'));
