-- A nota continua sendo a fonte auditável dos itens. Categorias ficam por item,
-- pois uma única compra pode conter alimentação, higiene e limpeza.
alter table public.receipt_items
  add column category text not null default 'Outros' check(length(trim(category)) between 1 and 100),
  add column unit_cents bigint check(unit_cents is null or unit_cents > 0),
  add column extraction_source text not null default 'manual' check(extraction_source in ('manual','local_ocr','ai'));

create index receipt_items_category_date_idx
  on public.receipt_items(household_id, purchased_on desc, category)
  where not archived;

-- Dados do abastecimento pertencem ao próprio lançamento financeiro: não há
-- uma segunda despesa para combustível. Todos são opcionais, exceto quando
-- a pessoa escolhe registrar o abastecimento pela interface.
alter table public.transactions
  add column fuel_liters numeric(12,3) check(fuel_liters is null or fuel_liters > 0),
  add column fuel_unit_cents bigint check(fuel_unit_cents is null or fuel_unit_cents > 0),
  add column fuel_station text not null default '' check(length(fuel_station) <= 150),
  add column fuel_odometer integer check(fuel_odometer is null or fuel_odometer >= 0);

-- A função validada é a única forma de inserir lançamentos; portanto ela
-- valida e persiste os campos de combustível juntamente com a despesa.
create or replace function public.post_transaction(operation_id uuid, payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); h uuid; k text; s text; amt bigint; dt date; source uuid; target uuid; card uuid;
 oldop public.finance_operations%rowtype; tx public.transactions%rowtype; c public.cards%rowtype;
 n int; i int; due_item record; first_due date; closing date; due date; base bigint; remainder bigint; owed bigint;
 fuel_l numeric; fuel_unit bigint; fuel_station_value text; fuel_odometer_value integer;
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
 if card is not null then select * into c from public.cards where id=card and owner_user_id=actor and household_id=h and not archived for update; if not found then raise exception 'Cartão não autorizado' using errcode='42501'; end if; end if;
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
  n:=coalesce((payload->>'installments')::int,1); if n<1 or n>120 or n>amt then raise exception 'Parcelamento inválido'; end if;
  select coalesce(sum(i.amount_cents),0) into owed from public.card_installments i join public.transactions t on t.id=i.transaction_id where i.card_id=card and t.status='posted';
  owed:=owed-coalesce((select sum(p.amount_cents) from public.invoice_payments p join public.transactions t on t.id=p.transaction_id where p.card_id=card and t.status='posted'),0);
  if owed+amt>c.limit_cents then raise exception 'Compra excede limite disponível'; end if;
 end if;
 fuel_l:=nullif(payload->>'fuel_liters','')::numeric; fuel_unit:=nullif(payload->>'fuel_unit_cents','')::bigint; fuel_station_value:=coalesce(payload->>'fuel_station',''); fuel_odometer_value:=nullif(payload->>'fuel_odometer','')::integer;
 if fuel_l is not null or fuel_unit is not null or fuel_odometer_value is not null or fuel_station_value<>'' then
  if k<>'expense' or fuel_l is null or fuel_unit is null or fuel_l<=0 or fuel_unit<=0 or abs(amt-round(fuel_l*fuel_unit))>1 then raise exception 'Dados de abastecimento incompatíveis com o valor pago'; end if;
 end if;
 if nullif(payload->>'due_item_id','') is not null then
  select * into due_item from public.due_items where id=(payload->>'due_item_id')::uuid for update;
  if not found or due_item.owner_user_id<>actor or due_item.household_id<>h or due_item.scope<>s or due_item.amount_cents<>amt or k<>'expense' or due_item.paid_transaction_id is not null or due_item.archived then raise exception 'Conta a pagar incompatível ou já paga' using errcode='40001'; end if;
 end if;
 insert into public.transactions(id,household_id,owner_user_id,scope,kind,description,amount_cents,occurred_on,category,merchant,method,fuel_liters,fuel_unit_cents,fuel_station,fuel_odometer)
 values(operation_id,h,actor,s,k,trim(payload->>'description'),amt,dt,coalesce(nullif(payload->>'category',''),'Outros'),coalesce(payload->>'merchant',''),case when card is not null and k='expense' then 'card' when source is not null then 'account' else 'untracked' end,fuel_l,fuel_unit,fuel_station_value,fuel_odometer_value);
 if source is not null then insert into public.ledger_entries(transaction_id,account_id,amount_cents) values(operation_id,source,case when k='income' then amt else -amt end); end if;
 if k='transfer' then insert into public.ledger_entries(transaction_id,account_id,amount_cents) values(operation_id,target,amt); end if;
 if k='card_payment' then insert into public.invoice_payments values(operation_id,card,due,amt); end if;
 if k='expense' and card is not null then
  closing:=app_private.month_day(dt,c.closing_day); if dt>=closing then closing:=app_private.month_day((date_trunc('month',dt)+interval '1 month')::date,c.closing_day); end if;
  first_due:=app_private.month_day(closing,c.due_day); if first_due<=closing then first_due:=app_private.month_day((date_trunc('month',closing)+interval '1 month')::date,c.due_day); end if;
  base:=amt/n; remainder:=amt%n;
  for i in 1..n loop insert into public.card_installments(transaction_id,card_id,number,due_on,amount_cents) values(operation_id,card,i,app_private.month_day((date_trunc('month',first_due)+(i-1)*interval '1 month')::date,c.due_day),base+case when i<=remainder then 1 else 0 end); end loop;
 end if;
 if nullif(payload->>'due_item_id','') is not null then update public.due_items set paid_transaction_id=operation_id where id=(payload->>'due_item_id')::uuid; end if;
 insert into public.finance_operations values(actor,operation_id,payload,operation_id,now());
 insert into public.audit_events(household_id,owner_user_id,entity_id,action,details) values(h,actor,operation_id,'created',jsonb_build_object('kind',k,'amount_cents',amt));
 return operation_id;
end $$;
revoke all on function public.post_transaction(uuid,jsonb) from public,anon;
grant execute on function public.post_transaction(uuid,jsonb) to authenticated;
