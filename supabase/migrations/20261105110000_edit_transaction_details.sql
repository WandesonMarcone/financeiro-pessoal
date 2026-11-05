-- Edição controlada dos dados descritivos de um lançamento.
create or replace function public.edit_transaction_details(transaction_id uuid, expected_version integer, new_description text, new_category text, new_subcategory text, new_merchant text, new_occurred_on date) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); tx public.transactions%rowtype;
begin
 if actor is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
 select * into tx from public.transactions where id=transaction_id for update;
 if not found or tx.owner_user_id<>actor then raise exception 'Lançamento não autorizado' using errcode='42501'; end if;
 if tx.status<>'posted' or tx.version<>expected_version then raise exception 'Conflito: atualize a página antes de editar' using errcode='40001'; end if;
 if nullif(trim(new_description),'') is null or new_occurred_on is null then raise exception 'Descrição e data são obrigatórias'; end if;
 update public.transactions set description=trim(new_description),category=coalesce(nullif(trim(new_category),''),'Outros'),subcategory=coalesce(trim(new_subcategory),''),merchant=coalesce(trim(new_merchant),''),occurred_on=new_occurred_on,version=version+1 where id=tx.id;
 update public.receipt_items set purchased_on=new_occurred_on where document_id in (select id from public.documents where transaction_id=tx.id);
 insert into public.audit_events(household_id,owner_user_id,entity_id,action,details) values(tx.household_id,actor,tx.id,'edited_details',jsonb_build_object('old_date',tx.occurred_on,'new_date',new_occurred_on));
 return tx.id;
end $$;
revoke all on function public.edit_transaction_details(uuid,integer,text,text,text,text,date) from public,anon;
grant execute on function public.edit_transaction_details(uuid,integer,text,text,text,text,date) to authenticated;
