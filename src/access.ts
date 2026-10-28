import { createClient, type SupabaseClient } from '@supabase/supabase-js';
export type Ready = {kind:'ready'; userId:string; householdId:string; householdName:string; displayName:string};
export type Access = {kind:'signedout'} | {kind:'denied'} | Ready;
export interface Gateway {
 readAccess():Promise<Access>;
 subscribe(callback:()=>void):()=>void;
 signIn(email:string,password:string):Promise<void>;
 signOut():Promise<void>;
 saveProfile(userId:string,name:string):Promise<void>;
}
export function supabaseGateway(client:SupabaseClient):Gateway {
 return {
  async readAccess(){
   const {data:session,error:sessionError}=await client.auth.getSession();
   if(sessionError) throw sessionError;
   if(!session.session) return {kind:'signedout'};
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
   return {kind:'ready',userId:auth.user.id,householdId:household.data.id,householdName:household.data.name,displayName:profile.data?.display_name??''};
  },
  subscribe(callback){
   const {data}=client.auth.onAuthStateChange(()=>callback());
   return ()=>data.subscription.unsubscribe();
  },
  async signIn(email,password){const {error}=await client.auth.signInWithPassword({email,password});if(error) throw error;},
  async signOut(){const {error}=await client.auth.signOut({scope:'local'});if(error) throw error;},
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
 return supabaseGateway(createClient(url,key,{auth:{storage:window.sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}));
}

