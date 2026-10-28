-- Teste local destrutivo somente dentro da transação; todos os dados são fictícios.
begin;
insert into auth.users(id) values
('00000000-0000-4000-8000-000000000101'),
('00000000-0000-4000-8000-000000000102'),
('00000000-0000-4000-8000-000000000103');
insert into public.households(id,name) values
('00000000-0000-4000-8000-000000000201','Família teste A'),
('00000000-0000-4000-8000-000000000202','Família teste B');
insert into public.memberships(household_id,user_id,role,status) values
('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000101','manager','active'),
('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000102','member','active'),
('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000103','member','active');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
insert into public.accounts(id,household_id,owner_user_id,name,opening_cents) values
('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000201',auth.uid(),'Conta A',0),
('00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000201',auth.uid(),'Reserva A',0);
insert into public.cards(id,household_id,owner_user_id,name,limit_cents,closing_day,due_day) values
('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000201',auth.uid(),'Cartão A',500000,20,5);

select public.post_transaction('00000000-0000-4000-8000-000000000501',
 '{"household_id":"00000000-0000-4000-8000-000000000201","kind":"income","scope":"personal","description":"Receita teste","amount_cents":100000,"occurred_on":"2026-10-01","account_id":"00000000-0000-4000-8000-000000000301"}');
select public.post_transaction('00000000-0000-4000-8000-000000000502',
 '{"household_id":"00000000-0000-4000-8000-000000000201","kind":"expense","scope":"family","description":"Despesa da casa","amount_cents":12345,"occurred_on":"2026-10-02","account_id":"00000000-0000-4000-8000-000000000301"}');
select public.post_transaction('00000000-0000-4000-8000-000000000503',
 '{"household_id":"00000000-0000-4000-8000-000000000201","kind":"expense","scope":"personal","description":"Despesa pessoal A","amount_cents":2222,"occurred_on":"2026-10-03","account_id":"00000000-0000-4000-8000-000000000301"}');
select public.post_transaction('00000000-0000-4000-8000-000000000504',
 '{"household_id":"00000000-0000-4000-8000-000000000201","kind":"transfer","scope":"personal","description":"Transferência interna","amount_cents":10000,"occurred_on":"2026-10-04","account_id":"00000000-0000-4000-8000-000000000301","target_account_id":"00000000-0000-4000-8000-000000000302"}');
select public.post_transaction('00000000-0000-4000-8000-000000000505',
 '{"household_id":"00000000-0000-4000-8000-000000000201","kind":"expense","scope":"personal","description":"Compra parcelada","amount_cents":10001,"occurred_on":"2026-10-19","card_id":"00000000-0000-4000-8000-000000000401","installments":3}');
select public.post_transaction('00000000-0000-4000-8000-000000000506',
 '{"household_id":"00000000-0000-4000-8000-000000000201","kind":"card_payment","scope":"personal","description":"Pagamento parcial","amount_cents":3000,"occurred_on":"2026-11-05","account_id":"00000000-0000-4000-8000-000000000301","card_id":"00000000-0000-4000-8000-000000000401","due_on":"2026-11-05"}');

-- Repetir a mesma operação é idempotente.
select public.post_transaction('00000000-0000-4000-8000-000000000502',
 '{"household_id":"00000000-0000-4000-8000-000000000201","kind":"expense","scope":"family","description":"Despesa da casa","amount_cents":12345,"occurred_on":"2026-10-02","account_id":"00000000-0000-4000-8000-000000000301"}');

do $$ begin
 if (select count(*) from public.transactions)<>6 then raise exception 'Idempotência falhou'; end if;
 if (select count(*) from public.card_installments where transaction_id='00000000-0000-4000-8000-000000000505')<>3 then raise exception 'Parcelas ausentes'; end if;
 if (select sum(amount_cents) from public.card_installments where transaction_id='00000000-0000-4000-8000-000000000505')<>10001 then raise exception 'Arredondamento de parcelas incorreto'; end if;
 if (select sum(amount_cents) from public.ledger_entries where account_id='00000000-0000-4000-8000-000000000301')<>72433 then raise exception 'Saldo da conta A incorreto'; end if;
 if (select sum(amount_cents) from public.ledger_entries where account_id='00000000-0000-4000-8000-000000000302')<>10000 then raise exception 'Transferência destino incorreta'; end if;
 if (select sum(amount_cents) from public.ledger_entries where transaction_id='00000000-0000-4000-8000-000000000504')<>0 then raise exception 'Transferência alterou patrimônio'; end if;
 begin
  perform public.post_transaction('00000000-0000-4000-8000-000000000502',
   '{"household_id":"00000000-0000-4000-8000-000000000201","kind":"expense","scope":"family","description":"Conteúdo trocado","amount_cents":12345,"occurred_on":"2026-10-02"}');
  raise exception 'Chave idempotente aceitou outro conteúdo';
 exception when unique_violation then null; end;
 begin
  insert into public.transactions(id,household_id,owner_user_id,scope,kind,description,amount_cents,occurred_on,method)
  values(gen_random_uuid(),'00000000-0000-4000-8000-000000000201',auth.uid(),'personal','expense','Ataque',1,current_date,'untracked');
  raise exception 'Escrita monetária direta permitida';
 exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
insert into public.accounts(id,household_id,owner_user_id,name,opening_cents) values
('00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000201',auth.uid(),'Conta B',0);
select public.post_transaction('00000000-0000-4000-8000-000000000601',
 '{"household_id":"00000000-0000-4000-8000-000000000201","kind":"expense","scope":"family","description":"Familiar paga por B","amount_cents":5000,"occurred_on":"2026-10-10"}');
select public.post_transaction('00000000-0000-4000-8000-000000000602',
 '{"household_id":"00000000-0000-4000-8000-000000000201","kind":"expense","scope":"personal","description":"Pessoal de B","amount_cents":7000,"occurred_on":"2026-10-11","account_id":"00000000-0000-4000-8000-000000000303"}');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
do $$ begin
 if (select count(*) from public.accounts)<>2 then raise exception 'Conta privada de B exposta'; end if;
 if (select count(*) from public.transactions where id='00000000-0000-4000-8000-000000000601')<>1 then raise exception 'Despesa familiar de B não compartilhada'; end if;
 if (select count(*) from public.transactions where id='00000000-0000-4000-8000-000000000602')<>0 then raise exception 'Despesa pessoal de B exposta'; end if;
 if (select count(*) from public.ledger_entries where account_id='00000000-0000-4000-8000-000000000303')<>0 then raise exception 'Movimento privado de B exposto'; end if;
 begin
  perform public.post_transaction(gen_random_uuid(),
   '{"household_id":"00000000-0000-4000-8000-000000000201","kind":"expense","scope":"personal","description":"Usar conta alheia","amount_cents":1,"occurred_on":"2026-10-12","account_id":"00000000-0000-4000-8000-000000000303"}');
  raise exception 'Conta alheia aceita';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.accounts(id,household_id,owner_user_id,name) values(gen_random_uuid(),'00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000102','Conta forjada');
  raise exception 'Dono forjado aceito';
 exception when insufficient_privilege then null; end;
end $$;

-- Um usuário de outra família não enxerga absolutamente nenhum dado financeiro da família A.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
do $$ begin
 if (select count(*) from public.accounts)<>0 or (select count(*) from public.cards)<>0
  or (select count(*) from public.transactions)<>0 or (select count(*) from public.audit_events)<>0
 then raise exception 'Dados cruzaram famílias'; end if;
end $$;

-- Revogação bloqueia imediatamente dados e RPC, inclusive com sessão ainda válida.
set local role postgres;
update public.memberships set status='revoked' where user_id='00000000-0000-4000-8000-000000000101';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
do $$ begin
 if (select count(*) from public.accounts)<>0 or (select count(*) from public.transactions)<>0 then raise exception 'Revogado ainda lê finanças'; end if;
 begin
  perform public.post_transaction(gen_random_uuid(),
   '{"household_id":"00000000-0000-4000-8000-000000000201","kind":"expense","scope":"personal","description":"Revogado","amount_cents":1,"occurred_on":"2026-10-20"}');
  raise exception 'Revogado ainda lança';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
