import {useEffect,useState} from 'react';
import {active,money,productKey,today,type Row,type Snapshot} from './domain';
import {receiptCategories,type ReceiptProduct} from './receipts';

type Draft=ReceiptProduct&{key:string;saved:boolean;category:string;brand:string};
export function ReceiptReview({products,expectedTotalCents,document,merchant,date,data,save}:{products:ReceiptProduct[];expectedTotalCents:number;document?:Row;merchant:string;date:string;data:Snapshot;save:(table:string,values:any)=>Promise<void>}){
 const [drafts,setDrafts]=useState<Draft[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{setDrafts(products.map((item,index)=>({...item,key:String(index),saved:false,category:item.category??'Outros',brand:item.brand??''})));setNotice('');setError('');},[products]);
 const existing=new Set(active(data,'receipt_items').filter(row=>row.document_id===document?.id).map(row=>[productKey(row.product_key),Number(row.quantity),Number(row.total_cents)].join('|')));
 async function confirm(){
  if(!document||document.upload_status!=='ready')return setError('Guarde a nota ou selecione um documento armazenado antes de salvar produtos.');
  setBusy(true);setError('');let count=0;
  try{for(const row of drafts.filter(row=>!row.saved)){
   const signature=[productKey(row.name),row.quantity,row.total_cents].join('|');
   if(existing.has(signature)){setDrafts(rows=>rows.map(item=>item.key===row.key?{...item,saved:true}:item));continue;}
   await save('receipt_items',{document_id:document.id,scope:document.scope,product_key:row.name,brand:row.brand,quantity:row.quantity,unit:row.unit,total_cents:row.total_cents,unit_cents:row.unit_cents??null,category:row.category,extraction_source:'ai',merchant,purchased_on:date||today()});
   existing.add(signature);setDrafts(rows=>rows.map(item=>item.key===row.key?{...item,saved:true}:item));count++;
  }setNotice(count?`${count} produto(s) e categorias registrados nesta nota.`:'Nenhum produto novo para registrar.');}
  catch(e){setError(e instanceof Error?e.message:'Falha ao salvar produtos. Os itens restantes podem ser tentados novamente.');}
  finally{setBusy(false);}
 }
 return <section className="panel" aria-label="Revisão dos produtos"><h2>Itens organizados</h2>
  <p className="small">A soma confere com {money(expectedTotalCents)}. Corrija uma categoria se necessário; o total do lançamento não será duplicado.</p>
  {drafts.map(row=><div className="receipt-item-review" key={row.key}><p>{row.saved?'✓ ':''}<strong>{row.name}</strong> · {row.quantity} {row.unit} · {money(row.unit_cents??Math.round(row.total_cents/row.quantity))}/{row.unit} · total {money(row.total_cents)}</p><label>Marca (se identificada)<input value={row.brand} disabled={row.saved} onChange={event=>setDrafts(items=>items.map(item=>item.key===row.key?{...item,brand:event.target.value}:item))} placeholder="Ex.: Itambé"/></label><label>Categoria<select value={row.category} disabled={row.saved} onChange={event=>setDrafts(items=>items.map(item=>item.key===row.key?{...item,category:event.target.value}:item))}>{receiptCategories.map(category=><option key={category}>{category}</option>)}</select></label></div>)}
  {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <button disabled={busy||!document||!drafts.some(row=>!row.saved)} onClick={()=>void confirm()}>{busy?'Salvando…':`Confirmar todos os ${drafts.length} produtos`}</button>
  {!document&&<p className="small">Primeiro toque em “Guardar documento”; depois confirme toda a compra.</p>}
 </section>;
}
