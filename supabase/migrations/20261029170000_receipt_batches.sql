-- Uma compra pode ser formada por várias fotos (páginas) do mesmo cupom.
-- Itens continuam auditáveis pela foto e pela linha de origem.
create table public.receipt_batches(
 id uuid primary key,
 household_id uuid not null references public.households(id),
 owner_user_id uuid not null default auth.uid() references auth.users(id),
 scope text not null default 'family' check(scope='family'),
 archived boolean not null default false,
 version integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 merchant text not null default '',
 purchased_on date,
 subtotal_cents bigint check(subtotal_cents is null or subtotal_cents>=0),
 discount_cents bigint not null default 0 check(discount_cents>=0),
 total_cents bigint check(total_cents is null or total_cents>0),
 payment_method text not null default '',
 fiscal_key text not null default '',
 status text not null default 'draft' check(status in ('draft','review','confirmed'))
);
alter table public.receipt_batches enable row level security;
create policy receipt_batches_read on public.receipt_batches for select to authenticated using(app_private.is_active_member(household_id));
create policy receipt_batches_insert on public.receipt_batches for insert to authenticated with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and scope='family' and version=1);
create policy receipt_batches_update on public.receipt_batches for update to authenticated using(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)) with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and scope='family');
create trigger receipt_batches_guard before update on public.receipt_batches for each row execute function app_private.guard_resource();
revoke all on public.receipt_batches from anon,authenticated;
grant select,insert,update on public.receipt_batches to authenticated;
create index receipt_batches_household_date on public.receipt_batches(household_id,purchased_on desc);
create unique index receipt_batches_fiscal_key on public.receipt_batches(household_id,fiscal_key) where fiscal_key<>'' and not archived;

create table public.receipt_pages(
 id uuid primary key,
 household_id uuid not null references public.households(id),
 owner_user_id uuid not null default auth.uid() references auth.users(id),
 scope text not null default 'family' check(scope='family'),
 archived boolean not null default false,
 version integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 receipt_batch_id uuid not null references public.receipt_batches(id),
 document_id uuid not null references public.documents(id),
 page_order smallint not null check(page_order between 1 and 50)
);
alter table public.receipt_pages enable row level security;
create policy receipt_pages_read on public.receipt_pages for select to authenticated using(app_private.is_active_member(household_id));
create policy receipt_pages_insert on public.receipt_pages for insert to authenticated with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and scope='family' and version=1);
create policy receipt_pages_update on public.receipt_pages for update to authenticated using(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id)) with check(owner_user_id=(select auth.uid()) and app_private.is_active_member(household_id) and scope='family');
create trigger receipt_pages_guard before update on public.receipt_pages for each row execute function app_private.guard_resource();
revoke all on public.receipt_pages from anon,authenticated;
grant select,insert,update on public.receipt_pages to authenticated;
create unique index receipt_pages_document_once on public.receipt_pages(receipt_batch_id,document_id) where not archived;
create unique index receipt_pages_order_once on public.receipt_pages(receipt_batch_id,page_order) where not archived;

alter table public.receipt_items add column receipt_batch_id uuid references public.receipt_batches(id);
alter table public.receipt_items add column source_key text;
create index receipt_items_batch_idx on public.receipt_items(receipt_batch_id) where receipt_batch_id is not null;
create unique index receipt_items_batch_source_once on public.receipt_items(receipt_batch_id,source_key) where receipt_batch_id is not null and source_key is not null and not archived;

create or replace function app_private.validate_receipt_page() returns trigger language plpgsql set search_path='' as $$
declare bh uuid; bo uuid; bs text; dh uuid; doid uuid; ds text;
begin
 select household_id,owner_user_id,scope into bh,bo,bs from public.receipt_batches where id=new.receipt_batch_id;
 select household_id,owner_user_id,scope into dh,doid,ds from public.documents where id=new.document_id;
 if bh is null or dh is null or bh<>new.household_id or dh<>new.household_id or bo<>new.owner_user_id or doid<>new.owner_user_id or bs<>new.scope or ds<>new.scope then
  raise exception 'Página de cupom incompatível' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function app_private.validate_receipt_page() from public,anon,authenticated;
create trigger receipt_page_parent before insert or update on public.receipt_pages for each row execute function app_private.validate_receipt_page();

create or replace function app_private.validate_parent() returns trigger language plpgsql set search_path='' as $$
declare h uuid; o uuid; s text; bh uuid; bo uuid; bs text;
begin
 if tg_table_name='goal_contributions' then
  select household_id,owner_user_id,scope into h,o,s from public.goals where id=new.goal_id;
 elsif tg_table_name='receipt_items' then
  select household_id,owner_user_id,scope into h,o,s from public.documents where id=new.document_id;
  if new.receipt_batch_id is not null then
   select household_id,owner_user_id,scope into bh,bo,bs from public.receipt_batches where id=new.receipt_batch_id;
   if bh is null or bh<>new.household_id or bo<>new.owner_user_id or bs<>new.scope then raise exception 'Compra incompatível' using errcode='42501'; end if;
  end if;
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

create trigger receipt_batches_audit after insert or update on public.receipt_batches for each row execute function app_private.audit_resource();
create trigger receipt_pages_audit after insert or update on public.receipt_pages for each row execute function app_private.audit_resource();
