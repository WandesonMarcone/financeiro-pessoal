-- Exclusão física do arquivo exige autenticação recente no cliente e só vale para o autor.
alter table public.documents drop constraint documents_upload_status_check;
alter table public.documents add constraint documents_upload_status_check check(upload_status in ('pending','ready','deleted'));
create policy family_documents_delete on storage.objects for delete to authenticated using(
 bucket_id='family-documents' and exists(
  select 1 from public.documents d where d.id::text=name and d.owner_user_id=(select auth.uid()) and not d.archived
 )
);
