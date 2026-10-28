-- Provisiona a única família inicial a partir de exatamente dois usuários já
-- criados em Supabase Auth. Executar apenas como administrador, uma vez.
-- O bloco aborta se qualquer vínculo/família/perfil já existir.
do $$
declare
  family_id uuid;
  first_user uuid;
  second_user uuid;
begin
  if exists(select 1 from public.households)
     or exists(select 1 from public.memberships)
     or exists(select 1 from public.profiles) then
    raise exception 'Provisionamento interrompido: identidade já inicializada';
  end if;

  select id into first_user from auth.users order by created_at, id limit 1;
  select id into second_user from auth.users order by created_at, id offset 1 limit 1;
  if first_user is null or second_user is null or first_user=second_user then
    raise exception 'É necessário ter exatamente dois usuários Auth';
  end if;

  insert into public.households(name) values ('Nossa Casa') returning id into family_id;
  insert into public.memberships(household_id,user_id,role,status)
  values
    (family_id,first_user,'member','active'),
    (family_id,second_user,'member','active');
  insert into public.profiles(user_id,display_name)
  values
    (first_user,'Usuário 1'),
    (second_user,'Usuário 2');
end $$;
