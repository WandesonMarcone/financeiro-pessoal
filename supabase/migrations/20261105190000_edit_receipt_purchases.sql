alter table public.transactions add column if not exists purchase_title text not null default '' check (length(trim(purchase_title)) <= 120);

create or replace function public.update_receipt_purchase(transaction_id uuid, expected_version integer, purchase_title_input text, description_input text, merchant_input text, occurred_on_input date, category_input text default 'Mercado', subcategory_input text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); tx public.transactions%rowtype;
begin
 if actor is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
 select * into tx from public.transactions where id=transaction_id for update;
 if not found or tx.owner_user_id<>actor or tx.kind<>'expense' or tx.status<>'posted' or tx.version<>expected_version then raise exception 'Compra não autorizada ou alterada' using errcode='42501'; end if;
 if not exists(select 1 from public.documents d where d.transaction_id=tx.id and not d.archived) then raise exception 'Esta edição é exclusiva para compras com nota fiscal vinculada'; end if;
 update public.transactions set purchase_title=trim(purchase_title_input),description=trim(description_input),merchant=trim(merchant_input),occurred_on=occurred_on_input,category=coalesce(nullif(trim(category_input),''),'Mercado'),subcategory=trim(coalesce(subcategory_input,'')),version=version+1 where id=tx.id;
 update public.receipt_items ri set merchant=trim(merchant_input),purchased_on=occurred_on_input,version=version+1 from public.documents d where ri.document_id=d.id and d.transaction_id=tx.id and not d.archived;
 return tx.id;
end $$;
revoke all on function public.update_receipt_purchase(uuid,integer,text,text,text,date,text,text) from public;
revoke execute on function public.update_receipt_purchase(uuid,integer,text,text,text,date,text,text) from anon;
grant execute on function public.update_receipt_purchase(uuid,integer,text,text,text,date,text,text) to authenticated;