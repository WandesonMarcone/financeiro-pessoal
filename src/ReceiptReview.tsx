import {useEffect,useState} from 'react';
import {active,money,productKey,today,type Row,type Snapshot} from './domain';
import {receiptCategories,type ReceiptProduct} from './receipts';

type Draft=ReceiptProduct&{key:string;saved:boolean;category:string;brand:string};
export function ReceiptReview({products,expectedTotalCents,document,merchant,date,data,save,onSaveDocument}:{products:ReceiptProduct[];expectedTotalCents:number;document?:Row;merchant:string;date:string;data:Snapshot;save:(table:string,values:any)=>Promise<void>;onSaveDocument?:()=>Promise<Row|undefined>}){
 const [drafts,setDrafts]=useState<Draft[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{setDrafts(products.map((item,index)=>({...item,key:String(index),saved:false,category:item.category??'Outros',brand:item.brand??''})));setNotice('');setError('');},[products]);
 async function confirm(){
  setBusy(true);setError('');let count=0;
  try{const target=document?.upload_status==='ready'?document:await onSaveDocument?.();
   if(!target||target.upload_status!=='ready')throw Error('Não foi possível guardar a nota. Ela continua como rascunho neste aparelho.');
   const existing=new Set(active(data,'receipt_items').filter(row=>row.document_id===target.id).map(row=>[productKey(row.product_key),Number(row.quantity),Number(row.total_cents)].join('|')));
   for(const row of drafts.filter(row=>!row.saved)){
   const signature=[productKey(row.name),row.quantity,row.total_cents].join('|');
   if(existing.has(signature)){setDrafts(rows=>rows.map(item=>item.key===row.key?{...item,saved:true}:item));continue;}
   const unit_cents=row.unit_cents??((row.unit==='kg'||row.unit==='l')?Math.round(row.total_cents/row.quantity):null);
   await save('receipt_items',{document_id:target.id,scope:target.scope,product_key:row.name,brand:row.brand,quantity:row.quantity,unit:row.unit,total_cents:row.total_cents,unit_cents,category:row.category,extraction_source:'ai',merchant,purchased_on:date||today()});
   existing.add(signature);setDrafts(rows=>rows.map(item=>item.key===row.key?{...item,saved:true}:item));count++;
  }setNotice(count?`${count} produto(s) e categorias registrados nesta nota.`:'Nenhum produto novo para registrar.');}
  catch(e){setError(e instanceof Error?e.message:'Falha ao salvar produtos. Os itens restantes podem ser tentados novamente.');}
  finally{setBusy(false);}
 }
 return <section className="panel" aria-label="Revisão dos produtos"><h2>Itens organizados</h2>
  <p className="small">A soma confere com {money(expectedTotalCents)}. Para kg e litros, o preço por unidade será guardado para comparar compras futuras; se o PDF não o imprimir, ele é calculado pelo total dividido pela quantidade.</p>
  {drafts.map(row=><div className="receipt-item-review" key={row.key}><p>{row.saved?'✓ ':''}<strong>{row.name}</strong> · {row.quantity} {row.unit} · {money(row.unit_cents??Math.round(row.total_cents/row.quantity))}/{row.unit} · total {money(row.total_cents)}</p><label>Marca (se identificada)<input value={row.brand} disabled={row.saved} onChange={event=>setDrafts(items=>items.map(item=>item.key===row.key?{...item,brand:event.target.value}:item))} placeholder="Ex.: Itambé"/></label><label>Categoria<select value={row.category} disabled={row.saved} onChange={event=>setDrafts(items=>items.map(item=>item.key===row.key?{...item,category:event.target.value}:item))}>{receiptCategories.map(category=><option key={category}>{category}</option>)}</select></label></div>)}
  {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <button disabled={busy||!drafts.some(row=>!row.saved)} onClick={()=>void confirm()}>{busy?'Salvando…':document?'Confirmar todos os '+drafts.length+' produtos':'Guardar nota e confirmar '+drafts.length+' produtos'}</button>
  {!document&&<p className="small">A nota ainda é um rascunho neste aparelho. Ela será guardada somente ao confirmar estes itens.</p>}
 </section>;
}
