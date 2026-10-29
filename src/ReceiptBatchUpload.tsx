import {useMemo,useState} from 'react';
import type {Ready} from './access';
import type {FinanceAPI} from './finance';
import {cents,money,today,type Snapshot} from './domain';
import {checksum,receiptReconciliation,recognize,type ReceiptAnalysis,type ReceiptProduct} from './receipts';

const stores=['Assaí','Supermercado BH','Supermercados Leal','Outro (informar abaixo)'];
type ProductWithPage=ReceiptProduct&{page:number};

export function ReceiptBatchUpload({api,access,data,refresh}:{api:FinanceAPI;access:Ready;data:Snapshot;refresh:()=>Promise<void>}){
 const [files,setFiles]=useState<File[]>([]),[analyses,setAnalyses]=useState<ReceiptAnalysis[]>([]),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [store,setStore]=useState('Assaí'),[otherStore,setOtherStore]=useState('');
 const selectedStore=store.startsWith('Outro')?otherStore.trim():store;
 const tagged=useMemo(()=>analyses.flatMap((analysis,page)=>analysis.products.map(product=>({...product,page}))),[analyses]);
 const products=useMemo(()=>{
  const kept:ProductWithPage[]=[];const seen=new Set<string>();
  for(const row of tagged){const key=row.sourceKey?[row.sourceKey,row.name.toLocaleLowerCase(),row.quantity,row.total_cents].join('|'):'';if(key&&seen.has(key))continue;if(key)seen.add(key);kept.push(row);}
  return kept;
 },[tagged]);
 const finalAnalysis=analyses.findLast(item=>item.total)||analyses.at(-1);
 const check=receiptReconciliation(products,finalAnalysis?.total??'',finalAnalysis?.subtotal??'',finalAnalysis?.discount??'');
 const ready=analyses.length===files.length&&files.length>0&&check.consistent&&!!selectedStore;
 function choose(next:FileList|null){
  const valid=[...(next??[])].filter(file=>['image/jpeg','image/png','image/webp'].includes(file.type)&&file.size<=10485760);
  setFiles(valid);setAnalyses([]);setError(valid.length?(next&&valid.length!==next.length?'Algum arquivo foi ignorado: use fotos JPEG, PNG ou WebP de até 10 MB.':''):'Escolha ao menos uma foto do cupom.');setNotice('');
 }
 async function read(){
  setBusy(true);setError('');setNotice('');const output:ReceiptAnalysis[]=[];
  try{for(let index=0;index<files.length;index++){setProgress(`Lendo foto ${index+1} de ${files.length}…`);output.push(await recognize(files[index],message=>setProgress(`Foto ${index+1}/${files.length}: ${message}`)));}setAnalyses(output);}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível ler as fotos.');setAnalyses([]);}finally{setBusy(false);setProgress('');}
 }
 async function confirm(){
  if(!ready||!finalAnalysis) return;
  setBusy(true);setError('');
  try{
   const fiscalKey='';
   if(fiscalKey&&data.receipt_batches.some(row=>row.fiscal_key===fiscalKey&&!row.archived))throw Error('Esta nota fiscal já foi registrada.');
   const batchId=crypto.randomUUID();
   await api.save('receipt_batches' as any,{id:batchId,household_id:access.householdId,owner_user_id:access.userId,scope:'family',merchant:selectedStore,purchased_on:finalAnalysis.date||today(),subtotal_cents:finalAnalysis.subtotal?cents(finalAnalysis.subtotal):null,discount_cents:finalAnalysis.discount?cents(finalAnalysis.discount):0,total_cents:cents(finalAnalysis.total),payment_method:'',fiscal_key:fiscalKey,status:'confirmed',version:1} as any);
   const docs:any[]=[];
   for(let index=0;index<files.length;index++){
    const file=files[index],hash=await checksum(file);let doc=data.documents.find(row=>row.checksum===hash&&row.owner_user_id===access.userId&&!row.archived);
    if(!doc){doc={id:crypto.randomUUID(),household_id:access.householdId,owner_user_id:access.userId,scope:'family',filename:file.name,mime_type:file.type,size_bytes:file.size,checksum:hash,version:1};await api.save('documents',doc as any);}
    if(doc.upload_status!=='ready'){await api.upload(doc.id,file);await api.save('documents',{id:doc.id,upload_status:'ready'} as any,doc.version);}
    docs.push(doc);await api.save('receipt_pages' as any,{id:crypto.randomUUID(),household_id:access.householdId,owner_user_id:access.userId,scope:'family',receipt_batch_id:batchId,document_id:doc.id,page_order:index+1,version:1} as any);
   }
   for(const product of products){await api.save('receipt_items' as any,{id:crypto.randomUUID(),household_id:access.householdId,owner_user_id:access.userId,scope:'family',document_id:docs[product.page].id,receipt_batch_id:batchId,source_key:product.sourceKey??null,product_key:product.name,brand:'',quantity:product.quantity,unit:product.unit,total_cents:product.total_cents,merchant:selectedStore,purchased_on:finalAnalysis.date||today(),version:1} as any);}
   await refresh();setNotice(`Compra do ${selectedStore} salva com ${products.length} itens e ${files.length} foto(s).`);setFiles([]);setAnalyses([]);
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível guardar esta compra. Nenhum item é apagado: tente novamente após atualizar.');}
  finally{setBusy(false);}
 }
 return <section className="panel" aria-label="Compra com várias fotos"><h2>Compra com várias fotos</h2>
  <p className="small">Para um cupom longo, tire fotos consecutivas com uma pequena sobreposição. O sistema só remove uma repetição quando o número fiscal do item e os valores são os mesmos.</p>
  <input aria-label="Fotos da mesma nota" type="file" accept="image/jpeg,image/png,image/webp" multiple capture="environment" onChange={event=>choose(event.target.files)}/>
  {files.length>0&&<p>{files.length} foto(s) selecionada(s).</p>}
  <label>Estabelecimento<select value={store} onChange={event=>setStore(event.target.value)}>{stores.map(name=><option key={name}>{name}</option>)}</select></label>
  {store.startsWith('Outro')&&<label>Nome do estabelecimento<input value={otherStore} onChange={event=>setOtherStore(event.target.value)} placeholder="Ex.: Mercado do bairro"/></label>}
  <div className="toolbar"><button type="button" disabled={!files.length||busy} onClick={()=>void read()}>{busy?'Lendo…':'Ler todas as fotos'}</button>{analyses.length===files.length&&<button type="button" disabled={!ready||busy} onClick={()=>void confirm()}>{busy?'Salvando…':`Confirmar compra (${products.length} itens)`}</button>}</div>
  {progress&&<p role="status">{progress}</p>}{error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {analyses.length===files.length&&<><p>{products.length} item(ns) lido(s), em {files.length} foto(s). Soma dos itens: {money(check.actual)}{finalAnalysis?.discount?` · desconto: ${money(cents(finalAnalysis.discount))}`:''} · valor pago: {finalAnalysis?.total?money(cents(finalAnalysis.total)):'não identificado'}.</p>
   {check.consistent?<p role="status">Compra conferida. A confirmação salva tudo como uma única compra.</p>:<p role="alert" className="error">A soma ainda não confere. Por segurança, os itens não serão salvos automaticamente.</p>}
  </>}</section>;
}
