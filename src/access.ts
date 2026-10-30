import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {financeAPI,type FinanceAPI} from './finance';
import {localDB,pendingFor,uploadDraftId} from './offline';
import type {Database} from './database.types';
export type Ready = {kind:'ready'; userId:string; householdId:string; householdName:string; displayName:string};
export type Access = {kind:'signedout'} | {kind:'denied'} | Ready;
export type Usage = {documents:number;photos:number;documentBytes:number;transactions:number;receiptItems:number;recurringRules:number;cards:number};
export interface Gateway {
 finance?:FinanceAPI;
 readAccess():Promise<Access>;
 subscribe(callback:(event?:string)=>void):()=>void;
 signIn(email:string,password:string):Promise<void>;
 signOut():Promise<void>;
 requestPasswordReset(email:string):Promise<void>;
 updatePassword(password:string):Promise<void>;
 getProfile():Promise<{email:string;avatarUrl:string}>;
 getUsage():Promise<Usage>;
 saveProfile(userId:string,name:string,file?:File):Promise<void>;
 updateEmail(email:string):Promise<void>;
 changePassword(currentPassword:string,newPassword:string):Promise<void>;
}
export function supabaseGateway(client:SupabaseClient<Database>):Gateway {
 const accessKey='nossa-casa:last-access';
 let lastAccess:Ready|undefined;
 try{const cached=JSON.parse(sessionStorage.getItem(accessKey)??'null');if(cached?.kind==='ready')lastAccess=cached;}catch{sessionStorage.removeItem(accessKey);}
 return {
  finance:financeAPI(client),
  async readAccess(){
   const {data:session,error:sessionError}=await client.auth.getSession();
   if(sessionError) throw sessionError;
   if(!session.session){lastAccess=undefined;sessionStorage.removeItem(accessKey);return {kind:'signedout'};}
   if(!navigator.onLine&&lastAccess?.userId===session.session.user.id)return lastAccess;
   const {data:auth,error}=await client.auth.getUser();
   if(error) throw error;
   if(!auth.user) return {kind:'signedout'};
   const {data:members,error:memberError}=await client.from('memberships').select('household_id').eq('user_id',auth.user.id).eq('status','active');
   if(memberError) throw memberError;
   if(members?.length!==1) return {kind:'denied'};
   const [household,profile]=await Promise.all([
    client.from('households').select('id,name').eq('id',members[0].household_id).maybeSingle(),
    client.from('profiles').select('display_name').eq('user_id',auth.user.id).maybeSingle()
   ]);
   if(household.error||profile.error) throw household.error||profile.error;
   if(!household.data) return {kind:'denied'};
   lastAccess={kind:'ready',userId:auth.user.id,householdId:household.data.id,householdName:household.data.name,displayName:profile.data?.display_name??''};
   sessionStorage.setItem(accessKey,JSON.stringify(lastAccess));
   return lastAccess;
  },
  subscribe(callback){
   const {data}=client.auth.onAuthStateChange(event=>callback(event));
   return ()=>data.subscription.unsubscribe();
  },
  async signIn(email,password){const {error}=await client.auth.signInWithPassword({email,password});if(error) throw error;},
  async requestPasswordReset(email){const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:new URL(import.meta.env.BASE_URL,window.location.origin).toString()});if(error)throw error;},
  async updatePassword(password){const {error}=await client.auth.updateUser({password});if(error)throw error;const out=await client.auth.signOut({scope:'local'});if(out.error)throw out.error;},
  async signOut(){
   const access=lastAccess;
   if(access&&(await pendingFor(access.userId)).length)throw Error('Sincronize, exporte ou descarte os lançamentos pendentes antes de sair.');
   if(access){
    await localDB.transaction('rw',localDB.outbox,localDB.snapshots,localDB.uploadDrafts,async()=>{
     await localDB.outbox.where('userId').equals(access.userId).delete();
     const snapshots=await localDB.snapshots.filter(row=>row.id.startsWith(access.userId+':')).primaryKeys();
     await localDB.snapshots.bulkDelete(snapshots);
     await localDB.uploadDrafts.delete(uploadDraftId(access.userId));
    });
    localStorage.removeItem('simple:'+access.userId);
   }
   sessionStorage.removeItem(accessKey);lastAccess=undefined;
   const {error}=await client.auth.signOut({scope:'local'});if(error) throw error;
  },
  async getProfile(){
   const db=client as SupabaseClient<any>,{data:userData,error:userError}=await client.auth.getUser();if(userError||!userData.user?.email)throw userError??Error('Sessão inválida.');
   const {data:profile,error}=await db.from('profiles').select('avatar_path').eq('user_id',userData.user.id).maybeSingle();if(error)throw error;
   let avatarUrl='';if(profile?.avatar_path){const result=await db.storage.from('profile-avatars').createSignedUrl(profile.avatar_path,60*10);if(result.error)throw result.error;avatarUrl=result.data.signedUrl;}
   return {email:userData.user.email,avatarUrl};
  },
  async getUsage(){
   const db=client as SupabaseClient<any>;
   const [docs,transactions,items,rules,cards]=await Promise.all([
    db.from('documents').select('size_bytes,mime_type').eq('archived',false),
    db.from('transactions').select('*',{count:'exact',head:true}).eq('archived',false),
    db.from('receipt_items').select('*',{count:'exact',head:true}).eq('archived',false),
    db.from('recurring_rules').select('*',{count:'exact',head:true}).eq('archived',false),
    db.from('cards').select('*',{count:'exact',head:true}).eq('archived',false)
   ]);
   for(const result of [docs,transactions,items,rules,cards])if(result.error)throw result.error;
   const rows=docs.data??[];
   return {documents:rows.length,photos:rows.filter(row=>String(row.mime_type).startsWith('image/')).length,documentBytes:rows.reduce((sum,row)=>sum+Number(row.size_bytes||0),0),transactions:transactions.count??0,receiptItems:items.count??0,recurringRules:rules.count??0,cards:cards.count??0};
  },
  async saveProfile(userId,name,file){
   const db=client as SupabaseClient<any>;const existing=await db.from('profiles').select('user_id,avatar_path').eq('user_id',userId).maybeSingle();
   if(existing.error) throw existing.error;
   let avatarPath=existing.data?.avatar_path??'';
   if(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2097152)throw Error('Use JPEG, PNG ou WebP de até 2 MB.');avatarPath=`${userId}/avatar.${file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'}`;const upload=await db.storage.from('profile-avatars').upload(avatarPath,file,{upsert:true,contentType:file.type});if(upload.error)throw upload.error;}
   const request=existing.data
    ?db.from('profiles').update({display_name:name,avatar_path:avatarPath}).eq('user_id',userId)
    :db.from('profiles').insert({user_id:userId,display_name:name,avatar_path:avatarPath});
   const {error}=await request.select('user_id').single();
   if(error) throw error;
  },
  async updateEmail(email){const {error}=await (client as any).auth.updateUser({email},{emailRedirectTo:new URL(import.meta.env.BASE_URL,window.location.origin).toString()});if(error)throw error;},
  async changePassword(currentPassword,newPassword){const {error}=await (client as any).auth.updateUser({current_password:currentPassword,password:newPassword});if(error)throw error;
  }
 };
}
export function configuredGateway():Gateway|null {
 const url=import.meta.env.VITE_SUPABASE_URL, key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key||!key.startsWith('sb_publishable_')||key.includes('SUBSTITUA')) return null;
 try {if(new URL(url).protocol!=='https:') return null;}catch{return null;}
 return supabaseGateway(createClient<Database>(url,key,{auth:{storage:window.sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}}));
}

