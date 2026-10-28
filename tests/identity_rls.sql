-- Execute somente em ambiente de desenvolvimento como postgres. Reverte todos os dados.
begin;
insert into auth.users(id) values
('00000000-0000-4000-8000-000000000101'),
('00000000-0000-4000-8000-000000000102'),
('00000000-0000-4000-8000-000000000103'),
('00000000-0000-4000-8000-000000000104');
insert into public.households(id,name) values
('00000000-0000-4000-8000-000000000201','Teste família A'),
('00000000-0000-4000-8000-000000000202','Teste família B');
insert into public.memberships(household_id,user_id,role,status) values
('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000101','manager','active'),
('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000102','member','active'),
('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000103','member','active');
insert into public.profiles(user_id,display_name) values
('00000000-0000-4000-8000-000000000102','Pessoa B'),
('00000000-0000-4000-8000-000000000103','Pessoa C');

set local role anon;
do $$ begin
  if has_table_privilege('anon','public.households','select')
    or has_table_privilege('anon','public.memberships','select')
    or has_table_privilege('anon','public.profiles','select')
    then raise exception 'Anônimo possui leitura'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000104',true);
do $$ begin
  if (select count(*) from public.households)<>0 or (select count(*) from public.profiles)<>0 or (select count(*) from public.memberships)<>0 then raise exception 'Não convidado lê dados'; end if;
  begin
    insert into public.profiles(user_id,display_name) values (auth.uid(),'Invasor');
    raise exception 'Não convidado criou perfil';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.memberships(household_id,user_id,role,status) values ('00000000-0000-4000-8000-000000000201',auth.uid(),'manager','active');
    raise exception 'Não convidado criou vínculo';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
insert into public.profiles(user_id,display_name) values (auth.uid(),'Pessoa A');
do $$ declare n integer; begin
  if (select count(*) from public.households)<>1 or (select name from public.households)<>'Teste família A' then raise exception 'Família cruzada'; end if;
  if (select count(*) from public.profiles)<>1 or (select display_name from public.profiles)<>'Pessoa A' then raise exception 'Perfil cruzado'; end if;
  update public.profiles set display_name='Alterado' where user_id=auth.uid();
  get diagnostics n = row_count;
  if n<>1 then raise exception 'Atualização própria falhou'; end if;
  update public.profiles set display_name='Ataque' where user_id='00000000-0000-4000-8000-000000000102';
  get diagnostics n = row_count;
  if n<>0 then raise exception 'Atualização cruzada'; end if;
  begin
    update public.profiles set user_id='00000000-0000-4000-8000-000000000104' where user_id=auth.uid();
    raise exception 'Troca de proprietário permitida';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.profiles where user_id=auth.uid();
    raise exception 'Exclusão permitida';
  exception when insufficient_privilege then null; end;
  begin
    update public.memberships set role='manager';
    raise exception 'Alteração de vínculo permitida';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.households(name) values ('Não autorizado');
    raise exception 'Criação de família permitida';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
do $$ begin
  if (select count(*) from public.profiles)<>1 or (select display_name from public.profiles)<>'Pessoa B' then raise exception 'Membro B vê perfil alheio'; end if;
  if (select count(*) from public.memberships)<>1 then raise exception 'Membro B vê vínculos alheios'; end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
do $$ begin
  if (select count(*) from public.households)<>1 or (select name from public.households)<>'Teste família B' then raise exception 'Outra família lê dados'; end if;
end $$;

set local role postgres;
update public.memberships set status='revoked' where user_id='00000000-0000-4000-8000-000000000101';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
do $$ declare n integer; begin
  if (select count(*) from public.households)<>0 or (select count(*) from public.profiles)<>0 or (select count(*) from public.memberships)<>0 then raise exception 'Revogado lê dados'; end if;
  update public.profiles set display_name='Revogado' where user_id=auth.uid();
  get diagnostics n = row_count;
  if n<>0 then raise exception 'Revogado altera perfil'; end if;
end $$;
rollback;

