import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {financeAPI,type FinanceAPI} from './finance';
import {localDB,pendingFor} from './offline';
import type {Database} from './database.types';
export type Ready = {kind:'ready'; userId:string; householdId:string; householdName:string; displayName:string};
export type Access = {kind:'signedout'} | {kind:'denied'} | Ready;
export interface Gateway {
 finance?:FinanceAPI;
 readAccess():Promise<Access>;
 subscribe(callback:(event?:string)=>void):()=>void;
 signIn(email:string,password:string):Promise<void>;
 signOut():Promise<void>;
 requestPasswordReset(email:string):Promise<void>;
 updatePassword(password:string):Promise<void>;
 saveProfile(userId:string,name:string):Promise<void>;
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
  async requestPasswordReset(email){const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});if(error)throw error;},
  async updatePassword(password){const {error}=await client.auth.updateUser({password});if(error)throw error;const out=await client.auth.signOut({scope:'local'});if(out.error)throw out.error;},
  async signOut(){
   const access=lastAccess;
   if(access&&(await pendingFor(access.userId)).length)throw Error('Sincronize, exporte ou descarte os lançamentos pendentes antes de sair.');
   if(access){
    await localDB.transaction('rw',localDB.outbox,localDB.snapshots,async()=>{
     await localDB.outbox.where('userId').equals(access.userId).delete();
     const snapshots=await localDB.snapshots.filter(row=>row.id.startsWith(access.userId+':')).primaryKeys();
     await localDB.snapshots.bulkDelete(snapshots);
    });
    localStorage.removeItem('simple:'+access.userId);
   }
   sessionStorage.removeItem(accessKey);lastAccess=undefined;
   const {error}=await client.auth.signOut({scope:'local'});if(error) throw error;
  },
  async saveProfile(userId,name){
   const existing=await client.from('profiles').select('user_id').eq('user_id',userId).maybeSingle();
   if(existing.error) throw existing.error;
   const request=existing.data
    ?client.from('profiles').update({display_name:name}).eq('user_id',userId)
    :client.from('profiles').insert({user_id:userId,display_name:name});
   const {error}=await request.select('user_id').single();
   if(error) throw error;
  }
 };
}
export function configuredGateway():Gateway|null {
 const url=import.meta.env.VITE_SUPABASE_URL, key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key||!key.startsWith('sb_publishable_')||key.includes('SUBSTITUA')) return null;
 try {if(new URL(url).protocol!=='https:') return null;}catch{return null;}
 return supabaseGateway(createClient<Database>(url,key,{auth:{storage:window.sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}}));
}

