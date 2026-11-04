import {useEffect,useState} from 'react';
import {active,cents,money,productKey,today,type Row,type Snapshot} from './domain';
import {foodProductGroups,receiptCategories,receiptChannels,type ReceiptProduct} from './receipts';

type Draft=ReceiptProduct&{key:string;saved:boolean;category:string;brand:string;subcategory:string;productGroup:string};
export function ReceiptReview({products,expectedTotalCents,document,merchant,date,data,save,onSaveDocument,onCreatePurchase}:{products:ReceiptProduct[];expectedTotalCents:number;document?:Row;merchant:string;date:string;data:Snapshot;save:(table:string,values:any,row?:Row)=>Promise<void>;onSaveDocument?:()=>Promise<Row|undefined>;onCreatePurchase?:(operationId:string)=>Promise<void>}){
 const [drafts,setDrafts]=useState<Draft[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[purchaseSaved,setPurchaseSaved]=useState(Boolean(document?.purchase_confirmed_at));
 useEffect(()=>{setDrafts(products.map((item,index)=>({...item,key:String(index),saved:false,category:item.category??'Outros',brand:item.brand??'',subcategory:item.subcategory??'Outro',productGroup:item.productGroup??'Outros'})));setPurchaseSaved(Boolean(document?.purchase_confirmed_at));setNotice('');setError('');},[products,document?.purchase_confirmed_at]);
 function change(key:string,patch:Partial<Draft>){setDrafts(items=>items.map(item=>item.key===key?{...item,...patch}:item));}
 async function confirm(){
  setBusy(true);setError('');let count=0;
  try{let target=document?.upload_status==='ready'?document:await onSaveDocument?.();
   if(!target||target.upload_status!=='ready')throw Error('Não foi possível guardar a nota. Ela continua como rascunho neste aparelho.');
   const readyTarget=target;
   const existing=new Set(active(data,'receipt_items').filter(row=>row.document_id===readyTarget.id).map(row=>[productKey(row.product_key),Number(row.quantity),Number(row.total_cents)].join('|')));
   for(const row of drafts.filter(row=>!row.saved)){
   const signature=[productKey(row.name),row.quantity,row.total_cents].join('|');
   if(existing.has(signature)){setDrafts(rows=>rows.map(item=>item.key===row.key?{...item,saved:true}:item));continue;}
   const unit_cents=row.unit_cents??((row.unit==='kg'||row.unit==='l')?Math.round(row.total_cents/row.quantity):null);
   await save('receipt_items',{document_id:readyTarget.id,scope:readyTarget.scope,product_key:row.name,brand:row.brand,quantity:row.quantity,unit:row.unit,total_cents:row.total_cents,unit_cents,category:row.category,subcategory:row.subcategory,product_group:row.productGroup,extraction_source:'ai',merchant,purchased_on:date||today()});
   existing.add(signature);setDrafts(rows=>rows.map(item=>item.key===row.key?{...item,saved:true}:item));count++;
  }
   if(!purchaseSaved&&onCreatePurchase){const operationId=target.purchase_operation_id||crypto.randomUUID();if(!target.purchase_operation_id){await save('documents',{purchase_operation_id:operationId},target);target={...target,purchase_operation_id:operationId};}await onCreatePurchase(operationId);await save('documents',{purchase_confirmed_at:new Date().toISOString()},target);setPurchaseSaved(true);}
   setNotice((count?`${count} produto(s) e categorias registrados. `:'')+(purchaseSaved?'Compra já registrada.':'Compra total registrada em Lançamentos.'));}
  catch(e){setError(e instanceof Error?e.message:'Falha ao salvar produtos. Os itens restantes podem ser tentados novamente.');}
  finally{setBusy(false);}
 }
 return <section className="panel" aria-label="Revisão dos produtos"><h2>Itens organizados</h2>
  <p className="small">A soma confere com {money(expectedTotalCents)}. Revise e corrija livremente: produto, marca, quantidade, valor e classificação. Para kg e litros, o preço por unidade será guardado para comparação futura.</p>
  {drafts.map(row=><div className="receipt-item-review" key={row.key}><p>{row.saved?'✓ ':''}<strong>{row.name}</strong> · {row.quantity} {row.unit} · {money(row.unit_cents??Math.round(row.total_cents/row.quantity))}/{row.unit} · total {money(row.total_cents)}</p><label>Produto<input value={row.name} disabled={row.saved} onChange={event=>change(row.key,{name:event.target.value})}/></label><label>Marca<input value={row.brand} disabled={row.saved} onChange={event=>change(row.key,{brand:event.target.value})} placeholder="Ex.: Dex"/></label><label>Quantidade<input type="number" min="0.001" step="0.001" value={row.quantity} disabled={row.saved} onChange={event=>{const quantity=Number(event.target.value);if(quantity>0)change(row.key,{quantity,unit_cents:(row.unit==='kg'||row.unit==='l')?Math.round(row.total_cents/quantity):row.unit_cents});}}/></label><label>Unidade<select value={row.unit} disabled={row.saved} onChange={event=>{const unit=event.target.value as ReceiptProduct['unit'];change(row.key,{unit,unit_cents:(unit==='kg'||unit==='l')?Math.round(row.total_cents/row.quantity):undefined});}}><option value="un">unidade</option><option value="kg">kg</option><option value="l">litro</option></select></label><label>Total (R$)<input inputMode="decimal" value={(row.total_cents/100).toFixed(2).replace('.',',')} disabled={row.saved} onChange={event=>{try{const total_cents=cents(event.target.value);if(total_cents>0)change(row.key,{total_cents,unit_cents:(row.unit==='kg'||row.unit==='l')?Math.round(total_cents/row.quantity):row.unit_cents});}catch{/* mantém a edição até o valor ficar válido */}}}/></label><label>Categoria principal<select value={row.category} disabled={row.saved} onChange={event=>change(row.key,{category:event.target.value})}>{receiptCategories.map(category=><option key={category}>{category}</option>)}</select></label><label>Tipo de compra<select value={row.subcategory} disabled={row.saved} onChange={event=>change(row.key,{subcategory:event.target.value})}>{receiptChannels.map(channel=><option key={channel}>{channel}</option>)}</select></label><label>Grupo do produto<select value={row.productGroup} disabled={row.saved} onChange={event=>change(row.key,{productGroup:event.target.value})}>{foodProductGroups.map(group=><option key={group}>{group}</option>)}</select></label></div>)}
  {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <button disabled={busy||(!drafts.some(row=>!row.saved)&&purchaseSaved)} onClick={()=>void confirm()}>{busy?'Salvando…':document?'Confirmar todos os '+drafts.length+' produtos':'Guardar nota e confirmar '+drafts.length+' produtos'}</button>
  {!document&&<p className="small">A nota ainda é um rascunho neste aparelho. Ela será guardada somente ao confirmar estes itens.</p>}
 </section>;
}
