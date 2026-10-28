-- Dados financeiros são compartilhados entre membros ativos da mesma família.
-- A autoria continua preservada para escrita e para a trilha de auditoria.
create or replace function app_private.can_read(h uuid, o uuid, s text)
returns boolean language sql stable security definer set search_path=''
as $$ select auth.uid() is not null and app_private.is_active_member(h) $$;
revoke all on function app_private.can_read(uuid,uuid,text) from public,anon;
grant execute on function app_private.can_read(uuid,uuid,text) to authenticated;

drop policy if exists accounts_read on public.accounts;
create policy accounts_read_household on public.accounts for select to authenticated
using (app_private.is_active_member(household_id));

drop policy if exists cards_read on public.cards;
create policy cards_read_household on public.cards for select to authenticated
using (app_private.is_active_member(household_id));

drop policy if exists audit_read on public.audit_events;
create policy audit_read_household on public.audit_events for select to authenticated
using (app_private.is_active_member(household_id));
