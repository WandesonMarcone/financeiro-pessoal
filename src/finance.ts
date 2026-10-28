import type {SupabaseClient} from '@supabase/supabase-js';
import {TABLES,type Row,type Snapshot,emptySnapshot} from './domain';
import type {Database} from './database.types';
export function financeAPI(client:SupabaseClient<Database>){
 const db=client as SupabaseClient<any>;
 return {
 async load(householdId:string):Promise<Snapshot>{
  const result=emptySnapshot();
  await Promise.all(TABLES.map(async(table)=>{
   let start=0;
   while(true){let q=db.from(table).select('*').order(table==='invoice_payments'?'transaction_id':'id').range(start,start+999);
    if(!['ledger_entries','card_installments','invoice_payments'].includes(table))q=q.eq('household_id',householdId);
    const {data,error}=await q;if(error)throw Error(error.message);result[table].push(...(data??[]).map((row:any)=>table==='invoice_payments'?{...row,id:row.transaction_id}:row));if(!data||data.length<1000)break;start+=1000;
   }
  }));return result;
 },
 async post(id:string,payload:any){const operationId=id as `${string}-${string}-${string}-${string}-${string}`;const {error}=await db.rpc('post_transaction',{operation_id:operationId,payload});if(error)throw Error(error.message);},
 async save(table:string,data:Row,version?:number){
  if(!TABLES.includes(table as any)||['transactions','ledger_entries','card_installments','invoice_payments','audit_events'].includes(table))throw Error('Tabela não editável');
  let q=version===undefined?db.from(table).insert(data):db.from(table).update(data).eq('id',data.id).eq('version',version);
  const {data:row,error}=await q.select('id').maybeSingle();
  if(error)throw Error(error.message);if(!row)throw Error('Conflito: este registro foi alterado ou seu acesso mudou. Atualize antes de tentar novamente.');
 },
 async upload(id:string,file:File){const {error}=await db.storage.from('family-documents').upload(id,file,{upsert:false,contentType:file.type});if(error)throw Error(error.message);},
 async download(id:string){const {data,error}=await db.storage.from('family-documents').download(id);if(error)throw Error(error.message);return data;}
 };
}
export type FinanceAPI=ReturnType<typeof financeAPI>;

