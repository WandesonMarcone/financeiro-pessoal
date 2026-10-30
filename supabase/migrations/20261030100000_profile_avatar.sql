-- Foto de perfil: privada e acessível apenas ao próprio usuário autenticado.
alter table public.profiles add column avatar_path text not null default '' check(length(avatar_path)<=300);
grant update (display_name,avatar_path) on public.profiles to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-avatars','profile-avatars',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

create policy profile_avatars_read_own on storage.objects for select to authenticated using(
 bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy profile_avatars_insert_own on storage.objects for insert to authenticated with check(
 bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy profile_avatars_update_own on storage.objects for update to authenticated using(
 bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
) with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy profile_avatars_delete_own on storage.objects for delete to authenticated using(
 bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
);
