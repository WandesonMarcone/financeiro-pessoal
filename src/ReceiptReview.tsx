import {useEffect,useState} from 'react';
import {active,money,productKey,today,type Row,type Snapshot} from './domain';
import {parseReceiptProducts,type ReceiptProduct} from './receipts';
import {CurrencyInput} from './CurrencyInput';

type Draft=ReceiptProduct&{key:string;selected:boolean;saved:boolean};
export function ReceiptReview({text,document,merchant,date,data,save}:{text:string;document?:Row;merchant:string;date:string;data:Snapshot;save:(table:string,values:any)=>Promise<void>}){
 const [drafts,setDrafts]=useState<Draft[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{setDrafts(parseReceiptProducts(text).map((item,index)=>({...item,key:String(index),selected:true,saved:false})));setNotice('');setError('');},[text]);
 const change=(key:string,patch:Partial<Draft>)=>setDrafts(rows=>rows.map(row=>row.key===key?{...row,...patch}:row));
 const existing=new Set(active(data,'receipt_items').filter(row=>row.document_id===document?.id).map(row=>[productKey(row.product_key),Number(row.quantity),Number(row.total_cents)].join('|')));
 async function confirm(){
  if(!document||document.upload_status!=='ready')return setError('Guarde a nota ou selecione um documento armazenado antes de salvar produtos.');
  setBusy(true);setError('');let count=0;
  try{for(const row of drafts.filter(row=>row.selected&&!row.saved)){
   const name=row.name.trim(),quantity=Number(row.quantity),total=Number(row.total_cents);
   if(!name||!Number.isFinite(quantity)||quantity<=0||!Number.isSafeInteger(total)||total<=0)throw Error('Revise nome, quantidade e preço de cada produto selecionado.');
   const signature=[productKey(name),quantity,total].join('|');
   if(existing.has(signature)){change(row.key,{saved:true});continue;}
   await save('receipt_items',{document_id:document.id,scope:document.scope,product_key:name,brand:'',quantity,unit:row.unit,total_cents:total,merchant,purchased_on:date||today()});
   existing.add(signature);change(row.key,{saved:true});count++;
  }setNotice(count?`${count} produto(s) registrado(s) nesta nota.`:'Nenhum produto novo para registrar.');}
  catch(e){setError(e instanceof Error?e.message:'Falha ao salvar produtos. Os itens restantes podem ser tentados novamente.');}
  finally{setBusy(false);}
 }
 return <section className="panel" aria-label="Revisão dos produtos"><h2>Produtos sugeridos pela leitura</h2>
  <p className="small">A leitura pode errar ou omitir itens. Confira cada linha com a nota; nenhum produto é salvo sem sua confirmação.</p>
  {!drafts.length&&<p>Nenhuma linha de produto identificada. Corrija o texto ou cadastre os itens manualmente no documento.</p>}
  {drafts.map(row=><div className="receipt-draft" key={row.key}>
   <label className="check"><input type="checkbox" checked={row.selected} disabled={busy||row.saved} onChange={e=>change(row.key,{selected:e.target.checked})}/>{row.saved?'Salvo':'Incluir'}</label>
   <label>Produto<input value={row.name} disabled={busy||row.saved} onChange={e=>change(row.key,{name:e.target.value})}/></label>
   <label>Quantidade<input type="number" min="0.0001" step="any" inputMode="decimal" value={row.quantity} disabled={busy||row.saved} onChange={e=>change(row.key,{quantity:Number(e.target.value)})}/></label>
   <label>Unidade<select value={row.unit} disabled={busy||row.saved} onChange={e=>change(row.key,{unit:e.target.value as ReceiptProduct['unit']})}><option value="un">un</option><option value="kg">kg</option><option value="l">l</option></select></label>
   <label>Preço total (R$)<CurrencyInput key={`${row.key}:${row.saved}`} defaultValue={(row.total_cents/100).toFixed(2)} disabled={busy||row.saved} onAmountChange={total_cents=>{if(total_cents===undefined){setError('Preço inválido.');return;}change(row.key,{total_cents});setError('');}}/></label>
   <span className="small">{money(row.total_cents)}</span>
  </div>)}
  {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {!!drafts.length&&<button disabled={busy||!document||!drafts.some(row=>row.selected&&!row.saved)} onClick={()=>void confirm()}>{busy?'Salvando…':'Confirmar produtos selecionados'}</button>}
  {!document&&<p className="small">Primeiro toque em “Guardar documento”; depois revise e confirme os produtos.</p>}
 </section>;
}
