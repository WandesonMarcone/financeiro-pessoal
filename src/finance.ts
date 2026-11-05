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
 async editTransactionDetails(transaction:Row,values:{description:string;category:string;subcategory:string;merchant:string;occurred_on:string}){const {error}=await db.rpc('edit_transaction_details',{transaction_id:transaction.id,expected_version:transaction.version,new_description:values.description,new_category:values.category,new_subcategory:values.subcategory,new_merchant:values.merchant,new_occurred_on:values.occurred_on});if(error)throw Error(error.message);},
 async save(table:string,data:Row,version?:number){
  if(!TABLES.includes(table as any)||['transactions','ledger_entries','card_installments','invoice_payments','audit_events'].includes(table))throw Error('Tabela não editável');
  let q=version===undefined?db.from(table).insert(data):db.from(table).update(data).eq('id',data.id).eq('version',version);
  const {data:row,error}=await q.select('id').maybeSingle();
  if(error)throw Error(error.message);if(!row)throw Error('Conflito: este registro foi alterado ou seu acesso mudou. Atualize antes de tentar novamente.');
 },
 async upload(id:string,file:File){const {error}=await db.storage.from('family-documents').upload(id,file,{upsert:false,contentType:file.type});if(error)throw Error(error.message);},
 async download(id:string){const {data,error}=await db.storage.from('family-documents').download(id);if(error)throw Error(error.message);return data;}
 ,async analyzeReceiptWithAI(file:File){
  if(!file.type.startsWith('image/'))throw Error('A análise por IA aceita foto JPEG, PNG ou WebP.');
  if(file.size>4*1024*1024)throw Error('Para análise por IA, use uma foto de até 4 MB.');
  const body=new FormData();body.append('receipt',file,file.name);
  const {data,error}=await db.functions.invoke('analyze-receipt',{body});
  if(error){
   const response=(error as {context?:unknown}).context;
   if(response instanceof Response){
    const failure=await response.json().catch(()=>null) as {error?:unknown}|null;
    if(typeof failure?.error==='string')throw Error(failure.error);
   }
   throw Error('Não foi possível falar com a análise por IA agora. Sua foto continua guardada; tente novamente.');
  }
  if(!data||typeof data!=='object')throw Error('A IA não retornou uma análise válida.');
  return data;
 }
 ,async removeDocument(id:string,password:string){
  const {data:userData,error:userError}=await db.auth.getUser();if(userError||!userData.user?.email)throw Error('Não foi possível confirmar a conta atual. Entre novamente e tente.');
  const {error:authError}=await db.auth.signInWithPassword({email:userData.user.email,password});if(authError)throw Error('Senha atual incorreta. O documento não foi apagado.');
  const {error}=await db.storage.from('family-documents').remove([id]);if(error)throw Error(error.message);
 }
 };
}
export type FinanceAPI=ReturnType<typeof financeAPI>;

