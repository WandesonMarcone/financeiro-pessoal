import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const db=new PGlite();
const setup=`
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema storage;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;
create table storage.buckets(
  id text primary key,name text not null,public boolean not null default false,
  file_size_limit bigint,allowed_mime_types text[]
);
create table storage.objects(
  id uuid primary key default gen_random_uuid(),bucket_id text not null,
  name text not null,owner_id text
);
alter table storage.objects enable row level security;
`;

try{
 await db.exec(setup);
 for(const migration of [
  'supabase/migrations/20261028105717_identity_family_rls.sql',
  'supabase/migrations/20261028161917_finance_modules.sql',
  'supabase/migrations/20261028162109_finance_indexes.sql',
  'supabase/migrations/20261028200000_shared_household_visibility.sql'
 ]) await db.exec(await readFile(migration,'utf8'));
 for(const test of ['tests/identity_rls.sql','tests/finance_rls.sql']){
  await db.exec(await readFile(test,'utf8'));
  console.log(`✓ ${test}`);
 }
}finally{
 await db.close();
}
