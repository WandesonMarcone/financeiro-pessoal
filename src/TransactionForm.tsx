import {useRef,useState,type FormEvent} from 'react';
import {active,cents,today,type Snapshot} from './domain';
import {CurrencyInput} from './CurrencyInput';
export function TransactionForm({snapshot,userId,initial={},onSave,onClose,simple=false}:{snapshot:Snapshot;userId:string;initial?:any;onSave:(payload:any,id?:string)=>Promise<void>;onClose:()=>void;simple?:boolean}){
 const operationId=useRef(crypto.randomUUID());
 const [kind,setKind]=useState(initial.kind??'expense'),[method,setMethod]=useState(initial.card_id?'card':initial.account_id?'account':'untracked'),[installments,setInstallments]=useState(Number(initial.installments??1)>1),[advanced,setAdvanced]=useState(Boolean(initial.kind&&initial.kind!=='expense')),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');try{const f=new FormData(e.currentTarget);const data:any={kind,description:f.get('description'),amount_cents:cents(String(f.get('amount'))),occurred_on:f.get('occurred_on'),scope:kind==='expense'?'family':'personal',category:f.get('category')||'Outros',merchant:f.get('merchant')||''};
 if(kind==='transfer'||kind==='income'||kind==='card_payment'||method==='account')data.account_id=f.get('account_id');
 if(kind==='transfer')data.target_account_id=f.get('target_account_id');
 if(kind==='card_payment'||(kind==='expense'&&method==='card')){data.card_id=f.get('card_id');data.installments=installments?Number(f.get('installments')||1):1;}
 if(kind==='card_payment')data.due_on=f.get('due_on');
 if(initial.due_item_id)data.due_item_id=initial.due_item_id;
 await onSave(data,operationId.current);onClose();
 }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar');}finally{setBusy(false);}}
 const accounts=active(snapshot,'accounts').filter(account=>account.owner_user_id===userId),cards=active(snapshot,'cards').filter(card=>card.owner_user_id===userId);
 return <section className="editor"><div className="row spread"><div><p className="eyebrow">LANÇAMENTO RÁPIDO</p><h2>{initial.due_item_id?'Pagar conta':'Registrar compra ou gasto'}</h2></div><button className="quiet" onClick={onClose}>Fechar</button></div><form onSubmit={submit} className="grid-form">
 {advanced&&!initial.due_item_id&&<label>Tipo<select value={kind} onChange={e=>setKind(e.target.value)}><option value="expense">Despesa / compra</option><option value="income">Receita</option><option value="transfer">Transferência</option><option value="card_payment">Pagamento de fatura</option></select></label>}
 <label>Descrição<input name="description" required maxLength={250} defaultValue={initial.description??''}/></label>
 <label>Valor (R$)<CurrencyInput aria-label="Valor (R$)" name="amount" required defaultValue={initial.amount_cents?(initial.amount_cents/100).toFixed(2):''}/><small>Digite só os números: 1000 vira R$ 10,00.</small></label>
 <label>Data<input name="occurred_on" type="date" required defaultValue={initial.occurred_on??today()}/></label>
 {kind==='expense'&&<label>Como pagou?<select value={method} onChange={e=>{setMethod(e.target.value);if(e.target.value!=='card')setInstallments(false);}}><option value="untracked">Ainda não quero vincular</option><option value="account">Pix, débito, dinheiro ou conta</option><option value="card">Cartão de crédito</option></select></label>}
 {(kind==='income'||kind==='transfer'||kind==='card_payment'||method==='account')&&<label>{kind==='income'?'Onde recebeu?':'Conta, Pix ou cartão de débito'}<select name="account_id" required defaultValue={initial.account_id??''}><option value="">Selecione</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
 {kind==='transfer'&&<label>Conta de destino<select name="target_account_id" required><option value="">Selecione</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
 {(kind==='card_payment'||(kind==='expense'&&method==='card'))&&<label>Cartão<select name="card_id" required defaultValue={initial.card_id??''}><option value="">Selecione</option>{cards.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
 {kind==='expense'&&method==='card'&&<label className="check"><input type="checkbox" checked={installments} onChange={e=>setInstallments(e.target.checked)}/>Compra parcelada</label>}
 {kind==='expense'&&method==='card'&&installments&&<label>Quantidade de parcelas<input name="installments" type="number" min="2" max="120" required defaultValue={initial.installments??2}/><small>O total será dividido sem perder centavos e cada parcela aparecerá na fatura correta.</small></label>}
 {kind==='card_payment'&&<label>Vencimento da fatura<input name="due_on" type="date" required defaultValue={initial.due_on??''}/></label>}
 {['expense','income'].includes(kind)&&<><label>Categoria<input name="category" list="categories" defaultValue={initial.category??(simple?'Alimentação':'Outros')}/><datalist id="categories">{[...new Set(['Alimentação','Moradia','Transporte','Saúde','Lazer','Salário','Outros',...active(snapshot,'categories').map(c=>c.name)])].map(c=><option key={c} value={c}/>)}</datalist></label><label>Estabelecimento<input name="merchant" defaultValue={initial.merchant??''}/></label></>}
 <p className="small">Aparecem apenas as suas contas e cartões. O lançamento é compartilhado com a família.</p>
 {error&&<p role="alert" className="error">{error}</p>}<button disabled={busy}>{busy?'Registrando…':'Salvar compra'}</button>{!advanced&&!initial.due_item_id&&<button type="button" className="quiet" onClick={()=>setAdvanced(true)}>Receita, transferência ou pagamento de fatura</button>}</form></section>;
}

