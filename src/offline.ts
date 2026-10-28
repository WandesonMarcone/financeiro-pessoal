import Dexie,{type Table} from 'dexie';
import type {Snapshot} from './domain';
export type Pending={id:string;userId:string;householdId:string;payload:any;createdAt:number;error?:string};
class LocalDB extends Dexie{
 outbox!:Table<Pending,string>; snapshots!:Table<{id:string;data:Snapshot},string>;
 constructor(){super('nossa-casa-v1');this.version(1).stores({outbox:'id,userId,householdId,createdAt',snapshots:'id'});}
}
export const localDB=new LocalDB();
export const cacheId=(u:string,h:string)=>u+':'+h;
export async function enqueue(userId:string,householdId:string,payload:any,id:string=crypto.randomUUID()){await localDB.outbox.put({id,userId,householdId,payload,createdAt:Date.now()});return id;}
export const pendingFor=(userId:string)=>localDB.outbox.where('userId').equals(userId).sortBy('createdAt');
export async function syncPending(userId:string,post:(id:string,payload:any)=>Promise<void>){
 const run=async()=>{for(const item of await pendingFor(userId)){if(item.error)continue;try{await post(item.id,item.payload);await localDB.outbox.delete(item.id);}catch(e){if(!navigator.onLine)break;await localDB.outbox.update(item.id,{error:e instanceof Error?e.message:'Falha de sincronização'});}}};
 if(navigator.locks)await navigator.locks.request('nossa-casa-sync-'+userId,run);else await run();
}

