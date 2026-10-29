import {useEffect,useState} from 'react';
import {active,money,productKey,today,type Row,type Snapshot} from './domain';
import type {ReceiptProduct} from './receipts';

type Draft=ReceiptProduct&{key:string;saved:boolean};
export function ReceiptReview({products,expectedTotalCents,document,merchant,date,data,save}:{products:ReceiptProduct[];expectedTotalCents:number;document?:Row;merchant:string;date:string;data:Snapshot;save:(table:string,values:any)=>Promise<void>}){
 const [drafts,setDrafts]=useState<Draft[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{setDrafts(products.map((item,index)=>({...item,key:String(index),saved:false})));setNotice('');setError('');},[products]);
 const existing=new Set(active(data,'receipt_items').filter(row=>row.document_id===document?.id).map(row=>[productKey(row.product_key),Number(row.quantity),Number(row.total_cents)].join('|')));
 async function confirm(){
  if(!document||document.upload_status!=='ready')return setError('Guarde a nota ou selecione um documento armazenado antes de salvar produtos.');
  setBusy(true);setError('');let count=0;
  try{for(const row of drafts.filter(row=>!row.saved)){
   const signature=[productKey(row.name),row.quantity,row.total_cents].join('|');
   if(existing.has(signature)){setDrafts(rows=>rows.map(item=>item.key===row.key?{...item,saved:true}:item));continue;}
   await save('receipt_items',{document_id:document.id,scope:document.scope,product_key:row.name,brand:'',quantity:row.quantity,unit:row.unit,total_cents:row.total_cents,merchant,purchased_on:date||today()});
   existing.add(signature);setDrafts(rows=>rows.map(item=>item.key===row.key?{...item,saved:true}:item));count++;
  }setNotice(count?`${count} produto(s) registrado(s) nesta nota.`:'Nenhum produto novo para registrar.');}
  catch(e){setError(e instanceof Error?e.message:'Falha ao salvar produtos. Os itens restantes podem ser tentados novamente.');}
  finally{setBusy(false);}
 }
 return <section className="panel" aria-label="Revisão dos produtos"><h2>Compra identificada</h2>
  <p className="small">Os produtos abaixo só são liberados porque a soma confere com o total da nota: {money(expectedTotalCents)}.</p>
  {drafts.map(row=><p key={row.key}>{row.saved?'✓ ':''}<strong>{row.name}</strong> · {row.quantity} {row.unit} · {money(row.total_cents)}</p>)}
  {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <button disabled={busy||!document||!drafts.some(row=>!row.saved)} onClick={()=>void confirm()}>{busy?'Salvando…':`Confirmar todos os ${drafts.length} produtos`}</button>
  {!document&&<p className="small">Primeiro toque em “Guardar documento”; depois confirme toda a compra.</p>}
 </section>;
}
