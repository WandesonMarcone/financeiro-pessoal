Warning: truncated output (original token count: 16507)
Total output lines: 282

import {useState,useEffect,useCallback,useRef,type FormEvent,type ReactNode} from 'react';
import type {Ready} from './access';
import type {FinanceAPI} from './finance';
import {active,balance,businessDaysBetween,cardSchedule,cents,emptySnapshot,fingerprint,invoices,money,monthDay,normalizeUnit,posted,productKey,projectCdiCents,summary,today,type Row,type Snapshot} from './domain';
import {localDB,cacheId,enqueue,pendingFor,syncPending,uploadDraftId,type Pending} from './offline';
import {ResourceEditor,type Field} from './ResourceEditor';
import {TransactionForm} from './TransactionForm';
import {CurrencyInput} from './CurrencyInput';
import {downloadBlob,exportData,exportReport,parseCSV} from './exports';
import {analysisFromAI,checksum,prepareImageForAI,readQR,recognize} from './receipts';
import {enableNotifications,notificationsAvailable,notifyDueItems} from './notifications';
import {ReceiptReview} from './ReceiptReview';
import {ReceiptBatchUpload} from './ReceiptBatchUpload';
import {SetupGuide,seededCategoryRows} from './onboarding';
import {CardVisual,cardTemplates} from './CardVisual';
const labels:Record<string,string>={dashboard:'Visão geral',transactions:'Lançamentos',accounts:'Contas',cards:'Cartões',due_items:'Contas a vencer',shopping_items:'Lista de compras',documents:'Notas e documentos',budgets:'Orçamentos',goals:'Metas e reservas',payroll_profiles:'Contracheque previsto',payroll_statements:'Contracheques',commitments:'Compromissos e conferências',assets:'Patrimônio',receipt_items:'Produtos e preços',reports:'Relatórios',recurring_rules:'Recorrências',categories:'Categorias',sync:'Sincronização',control:'Controle',profile:'Meu perfil',audit_events:'Histórico'};
export function purchaseFilename(file:File,merchant?:string,date?:string){const extension=file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()??(file.type==='application/pdf'?'pdf':'jpg'),place=(merchant||'documento').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'documento',day=/^\d{4}-\d{2}-\d{2}$/.test(date??'')?date!:today();return `compra-${place}-${day}.${extension}`;}
const baseFields:Record<string,Field[]>={
 accounts:[{key:'name',label:'Nome da conta'},{key:'opening_cents',label:'Saldo inicial (R$)',type:'money',default:'0'}],
 cards:[{key:'name',label:'Nome do cartão'},{key:'limit_cents',label:'Limite (R$)',type:'money'},{key:'closing_day',label:'Dia de fechamento',type:'number'},{key:'due_day',label:'Dia de vencimento',type:'number'}],
 categories:[{key:'name',label:'Categoria'},{key:'parent_name',label:'Agrupar em (opcional)',optional:true}],
 budgets:[{key:'month',label:'Primeiro dia do mês',type:'date',default:today().slice(0,7)+'-01'},{key:'category',label:'Categoria'},{key:'limit_cents',label:'Limite (R$)',type:'money'}],
 goals:[{key:'name',label:'Objetivo'},{key:'target_cents',label:'Meta (R$)',type:'money'},{key:'due_on',label:'Prazo (opcional)',type:'date',optional:true},{key:'goal_kind',label:'Tipo de meta',type:'select',options:[{value:'standard',label:'Sem rendimento'},{value:'yielding',label:'Dinheiro rendendo CDI'}],default:'standard'},{key:'yield_source',label:'Onde o dinheiro está guardado (opcional)',optional:true},{key:'cdi_percent',label:'Percentual do CDI (ex.: 120)',type:'number',default:'0'},{key:'cdi_annual_percent',label:'CDI anual usado na projeção (%)',type:'number',default:'0'},{key:'reported_balance_cents',label:'Saldo real informado (R$)',type:'money',optional:true},{key:'reported_balance_on',label:'Data do saldo real (opcional)',type:'date',optional:true}],
 payroll_profiles:[{key:'name',label:'Nome (ex.: Salário militar)'},{key:'gross_cents',label:'Salário bruto (R$)',type:'money'},{key:'payday_day',label:'Dia habitual de pagamento',type:'number'},{key:'notes',label:'Observações',type:'textarea',optional:true}],
 payroll_statements:[{key:'payroll_profile_id',label:'Fonte do salário',type:'select',options:[]},{key:'statement_month',label:'Mês de referência (primeiro dia)',type:'date',default:today().slice(0,7)+'-01'},{key:'statement_kind',label:'Tipo de pagamento',type:'select',options:[{value:'ordinary',label:'Salário normal'},{value:'thirteenth_advance',label:'13º - adiantamento'},{value:'thirteenth_balance',label:'13º - complemento'},{value:'vacation',label:'Férias'},{value:'adjustment',label:'Ajuste/outro'}],default:'ordinary'},{key:'paid_on',label:'Data em que caiu (opcional)',type:'date',optional:true},{key:'gross_cents',label:'Total de receitas do contracheque (R$)',type:'money'},{key:'deductions_cents',label:'Total de descontos (R$)',type:'money'},{key:'net_cents',label:'Líquido recebido (R$)',type:'money'},{key:'notes',label:'Observações',type:'textarea',optional:true}],
 commitments:[{key:'name',label:'Nome do compromisso'},{key:'kind',label:'Tipo',type:'select',options:[{value:'medical',label:'Despesa médica/FUSEx'},{value:'loan',label:'Empréstimo'},{value:'other',label:'Outro'}],default:'other'},{key:'payment_channel',label:'Como é cobrado?',type:'select',options:[{value:'payroll',label:'Vem no contracheque'},{value:'account_auto',label:'Débito automático após cair o salário'},{value:'manual',label:'Pagamento manual'}],default:'manual'},{key:'total_cents',label:'Valor total conhecido (R$, opcional)',type:'money',optional:true},{key:'notes',label:'Origem, parcela ou observações',type:'textarea',optional:true}],
 assets:[{key:'name',label:'Bem'},{key:'value_cents',label:'Valor registrado (R$)',type:'money'},{key:'acquired_on',label:'Data de aquisição',type:'date',optional:true},{key:'notes',label:'Observações',type:'textarea',optional:true}],
 due_items:[{key:'description',label:'Descrição'},{key:'amount_cents',label:'Valor (R$)',type:'money'},{key:'category',label:'Categoria',default:'Moradia'},{key:'due_on',label:'Vencimento',type:'date'}],
 recurring_rules:[{key:'description',label:'Descrição'},{key:'amount_cents',label:'Valor (R$)',type:'money'},{key:'category',label:'Categoria',default:'Moradia'},{key:'day',label:'Dia do mês',type:'number'},{key:'start_on',label:'Início',type:'date',default:today()},{key:'end_on',label:'Fim (opcional)',type:'date',optional:true}],
 shopping_items:[{key:'name',label:'Produto'},{key:'quantity',label:'Quantidade',type:'number',default:'1'},{key:'unit',label:'Unidade',default:'un'}]
};
const sharedScopeTables=new Set(['categories','budgets','goals','goal_contributions','payroll_profiles','payroll_deductions','payroll_statements','payroll_statement_items','commitments','commitment_occurrences','assets','due_items','recurring_rules','shopping_items','documents','receipt_items']);
async function stableId(value:string){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const h=[...bytes.slice(0,16)].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
const help:Record<string,{title:string;steps:string[];note:string}>={
 dashboard:{title:'Visão geral',steps:['Escolha o mês no filtro.','Use “Registrar gasto” para uma compra rápida.','Acompanhe gastos, receitas e contas vencidas.'],note:'Os números mostram lançamentos confirmados; documentos e OCR não criam gastos sozinhos.'},
 goals:{title:'Metas e reservas',steps:['Crie uma meta com valor e prazo.','Se o dinheiro rende, escolha “Dinheiro rendendo CDI” e informe a taxa exibida no seu aplicativo.','Registre cada aporte e, quando quiser, atualize o saldo real informado.'],note:'A projeção é estimativa; o saldo real informado por você é a referência.'},
 payroll_profiles:{title:'Contracheque previsto',steps:['Cadastre o salário bruto e o dia habitual de pagamento.','Adicione o empréstimo consignado, descontos fixos e consultas FUSEx previstas.','Confira o líquido previsto antes do pagamento e ajuste quando o contracheque chegar.'],note:'Consulta FUSEx registrada hoje pode ser prevista para o mês em que será descontada, sem duplicar a despesa.'},
 payroll_statements:{title:'Contracheques reais',steps:['Crie um contracheque por pagamento: normal, 13º, férias ou ajuste.','Use o mês de referência e a data em que o dinheiro caiu.','Adicione cada rubrica: soldo, adicionais e cada desconto.'],note:'O bruto de referência não cria receita. Somente cada contracheque real representa o que foi recebido.'},
 commitments:{title:'Compromissos e conferências',steps:['Cadastre a dívida, cirurgia ou empréstimo e informe o valor total se souber.','Defina se a cobrança vem no contracheque ou sai automaticamente da conta.','Registre o valor esperado e confirme cada cobrança que de fato ocorreu.'],note:'Empréstimo descontado depois do crédito do salário é saída da conta, não desconto do contracheque.'},
 cards:{title:'Cartões',steps:['Cadastre seu cartão e informe limite, fechamento e vencimento.','Ao registrar uma compra no crédito, escolha o cartão e as parcelas.','A fatura é calculada pelas compras; pagar a fatura não cria nova despesa.'],note:'Nunca informe número completo, senha ou CVV no aplicativo.'},
 documents:{title:'Notas e documentos',steps:['Escolha uma foto ou PDF.','Guarde o arquivo ou rode o OCR para revisar texto e produtos.','Se houver QR Code, abra apenas o link oficial.'],note:'O OCR é uma sugestão: confirme itens e total antes de salvar.'},
 due_items:{title:'Contas a vencer',steps:['Cadastre a conta e o vencimento.','Use recorrência para contas mensais.','Quando pagar, registre o pagamento pelo botão da própria conta.'],note:'O pagamento altera o saldo somente quando uma conta ou cartão é selecionado.'}
 ,categories:{title:'Categorias',steps:['Crie uma categoria simples, como “Lanche”.','Use “Agrupar em” somente se quiser criar uma subcategoria, como Lanche dentro de Alimentação.','Deixe “Agrupar em” vazio para uma categoria principal normal.'],note:'A categoria principal é apenas o grupo maior; não é obrigatória.'}
};
function Help({page}:{page:string}){const item=help[page]??{title:'Como usar esta tela',steps:['Use Adicionar para criar um registro.','Toque em Editar para corrigir dados.','Arquivar preserva o histórico sem apagar informações.'],note:'Tudo é sincronizado quando houver conexão.'};return <details className="help-guide"><summary>❔ Ajuda</summary><h2>{item.title}</h2><ol>{item.steps.map(step=><li key={step}>{step}</li>)}</ol><p>{item.note}</p></details>}
export function FinanceApp({api,access,profile}:{api:FinanceAPI;access:Ready;profile:ReactNode|((navigate:(page:string)=>void,hasPayroll:boolean)=>ReactNode)}){
 const [data,setData]=useState<Snapshot>(emptySnapshot),[loading,setLoading]=useState(true),[page,setPage]=useState('dashboard'),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [simple,setSimple]=useState(()=>localStorage.getItem('simple:'+access.userId)!=='false');
 const [offline,setOffline]=useState(!navigator.onLine),[pending,setPending]=useState<Pending[]>([]);
 const [editor,setEditor]=useState<{table:string;row?:Row;fields?:Field[];extra?:any}|null>(null),[transaction,setTransaction]=useState<any>(null);
 const [month,setMonth]=useState(today().slice(0,7)),[search,setSearch]=useState('');
 const own=(r:Row)=>r.owner_user_id===access.userId;
 const load=useCallback(async()=>{
  setPending(await pendingFor(access.userId));setOffline(!navigator.onLine);
  if(!navigator.onLine){const cached=await localDB.snapshots.get(cacheId(access.userId,access.householdId));if(cached)setData(cached.data);setLoading(false);return;}
  try{await syncPending(access.userId,(id,p)=>api.post(id,p));let snapshot=await api.load(access.householdId);
   // Recorrências: ao abrir/sincronizar, gerar contas até dois meses à frente.
   let changed=false;
   for(const rule of active(snapshot,'recurring_rules').filter(r=>r.owner_user_id===access.userId)){
    const end=new Date(today().slice(0,7)+'-01T12:00:00Z');end.setUTCMonth(end.getUTCMonth()+2);
    let cursor=new Date(rule.start_on.slice(0,7)+'-01T12:00:00Z'),iterations=0;
    while(cursor<=end&&iterations++<600){const date=monthDay(cursor.toISOString().slice(0,7),rule.day);
     if(date>=rule.start_on&&(!rule.end_on||date<=rule.end_on)&&!snapshot.due_items.some(d=>d.recurring_rule_id===rule.id&&d.due_on.slice(0,7)===date.slice(0,7))){
      const row={id:await stableId(rule.id+date.slice(0,7)),household_id:access.householdId,owner_user_id:access.userId,scope:'family',description:rule.description,category:rule.category,amount_cents:rule.amount_cents,due_on:date,recurring_rule_id:rule.id};
      try{await api.save('due_items',row);changed=true;}catch(e){if(!String(e).includes('duplicate key'))throw e;}
     }cursor.setUTCMonth(cursor.getUTCMonth()+1);
    }
   }
   if(changed)snapshot=await api.load(access.householdId);
   setData(snapshot);await localDB.snapshots.put({id:cacheId(access.userId,access.householdId),data:snapshot});setPending(await pendingFor(access.userId));setError('');
  }catch(e){setError(message(e));}finally{setLoading(false);}
 },[api,access.userId,access.householdId]);
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),30000);const refresh=()=>void load();window.addEventListener('online',refresh);window.addEventListener('offline',refresh);return()=>{clearInterval(timer);window.removeEventListener('online',refresh);window.removeEventListener('offline',refresh);};},[load]);
 async function save(table:string,values:any,row?:Row){
  if(!navigator.onLine)throw Error('Este cadastro exige conexão. Os lançamentos podem ser registrados offline.');
  const record=row?{id:row.id,...values}:{id:crypto.randomUUID(),household_id:access.householdId,owner_user_id:access.userId,...(sharedScopeTables.has(table)?{scope:'family'}:{}),...values};
  await api.save(table,record,row?.version);await load();
 }
 async function seedCategories(){
  const rows=seededCategoryRows(data,access.householdId,access.userId);
  if(!rows.length){setNotice('As categorias padrão já estão configuradas.');return;}
  for(const row of rows)await api.save('categories',row);
  await load();setNotice(`${rows.length} categorias padrão foram adicionadas.`);
 }
 async function post(payload:any,operationId?:string){const p={...payload,household_id:access.householdId};const id=await enqueue(access.userId,access.householdId,p,operationId);await load();const item=await localDB.outbox.get(id);if(item?.error)throw Error('Lançamento mantido na fila: '+item.error);setNotice(item?'Lançamento salvo neste aparelho. Será enviado quando houver conexão.':'Lançamento registrado.');}
 async function action(task:()=>Promise<void>){setError('');try{await task();}catch(e){setError(message(e));}}
 const rows=posted(data).filter(r=>(!month||r.occurred_on.startsWith(month))&&(!search||[r.description,r.category,r.merchant].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase())));
 const totals=summary(rows),due=active(data,'due_items').filter(r=>!r.paid_transaction_id&&r.due_on<=today());
 function newEditor(table:string,row?:Row){
  if(table==='payroll_statements'){setEditor({table,row,fields:baseFields.payroll_statements.map(field=>field.key==='payroll_profile_id'?{...field,options:active(data,'payroll_profiles').map(profile=>({value:profile.id,label:profile.name}))}:field)});return;}
  setEditor({table,row});
 }
 async function archive(table:string,row:Row){if(!confirm('Arquivar este registro? Ele continuará preservado no histórico.'))return;await save(table,{archived:true},row);}
 const personalPages=new Set(['cards','payroll_profiles','payroll_statements','commitments']);
 const filtered=active(data,page).filter(r=>(!personalPages.has(page)||own(r))&&(!search||String(r.name??r.description??r.product_key??r.filename??'').toLowerCase().includes(search.toLowerCase())));
 const nav=simple?['dashboard','transactions','shopping_items','documents','profile']:['dashboard','transactions','accounts','shopping_items','documents','budgets','goals','profile'];
 return <div className="workspace">
 <div className="workspace-top"><div><p className="eyebrow">{access.householdName}</p><h1>{labels[page]}</h1></div><button onClick={()=>setTransaction({})}>+ Registrar gasto</button></div>
 <div className="toolbar"><label className="check"><input type="checkbox" checked={simple} onChange={e=>{setSimple(e.target.checked);localStorage.setItem('simple:'+access.userId,String(e.target.checked));setEditor(null);setTransaction(null);setPage('dashboard');}}/>Modo simples</label><span className="badge">{offline?'Offline · dados deste aparelho':'Conectado'}</span><button className="quiet" onClick={()=>{setEditor(null);setTransaction(null);setPage('sync');}}>Fila: {pending.length}</button><button className="quiet" onClick={()=>void load()}>Atualizar</button></div>
 <nav aria-label="Módulos">{nav.map(key=><button key={key} className={page===key?'selected':'quiet'} onClick={()=>{setEditor(null);setTransaction(null);setPage(key);setSearch('');}}>{labels[key]}</button>)}</nav>
 <Help page={page}/>
 {error&&<p role="alert" className="banner error">{error}</p>}{notice&&<p role="status" className="banner">{notice}<button className="quiet" onClick={()=>setNotice('')}>Fechar</button></p>}
 {offline&&<p className="banner">Você está vendo uma cópia local. Novos lançamentos ficam pendentes até a confirmação do servidor.</p>}
 {transaction&&<TransactionForm key={JSON.stringify(transaction)} snapshot={data} userId={access.userId} initial={transaction} simple={simple&&!transaction.due_item_id} onSave={post} onClose={()=>setTransaction(null)} onAttachReceipt={()=>{setTransaction(null);setPage('documents');}}/>}
 {editor&&(editor.table==='cards'?<CardEditor initial={editor.row} onSave={values=>save('cards',{...values,...editor.extra},editor.row)} onClose={()=>setEditor(null)}/>:<ResourceEditor title={(editor.row?'Editar ':'Novo registro · ')+(labels[editor.table]??editor.table)} fields={editor.fields??baseFields[editor.table]} initial={editor.row} allowScope={false} onSave={values=>save(editor.table,{...values,...editor.extra},editor.row)} onClose={()=>setEditor(null)}/>)}
 {loading?<p role="status">Carregando seus dados…</p>:<>
 {['dashboard','transactions','reports'].includes(page)&&<div className="filters"><label>Mês<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><label>Pesquisar<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Descrição, categoria ou loja"/></label></div>}
 {page==='dashboard'&&<>
 <section className="panel dashboard-actions"><h2>O que você quer fazer?</h2><div className="toolbar"><button onClick={()=>setTransaction({})}>Registrar compra</button><button className="quiet" onClick={()=>setPage('documents')}>Ler cupom</button><button className="quiet" onClick={()=>setPage('cards')}>Ver faturas</button></div></section>
 <SetupGuide snapshot={data} onSeedCategories={seedCategories} onOpen={table=>{if(table==='transactions'){setTransaction({});return;}setPage(table);setSearch('');}}/>
 <div className="metrics"><Metric title="Receitas" value={money(totals.income)}/><Metric title="Despesas" value={money(totals.expense)}/><Metric title="Resultado do período" value={money(totals.income-totals.expense)}/><Metric title="Saldo das minhas contas" value={money(active(data,'accounts').reduce((n,a)=>n+balance(data,a),0))}/></div>
 <p className="small">Despesas por data da compra. Pagamentos de fatura e transferências não entram novamente nas despesas.</p>
 <section className="panel"><h2>Despesas por pagador</h2><p>Você: {money(rows.filter(r=>r.kind==='expense'&&own(r)).reduce((n,r)=>n+Number(r.amount_cents),0))}</p><p>Outro membro: {money(rows.filter(r=>r.kind==='expense'&&!own(r)).reduce((n,r)=>n+Number(r.amount_cents),0))}</p><p className="small">Comparativo informativo. Não gera dívidas entre vocês.</p></secti…6507 tokens truncated…thead><tbody>{[...groups.entries()].sort((a,b)=>b[1]-a[1]).map(([name,value])=><tr key={name}><td>{name}</td><td>{money(value)}</td></tr>)}</tbody></table></div>:<p>Nenhuma rubrica de desconto cadastrada neste ano.</p>}</section>;
}
function Products({rows}:{rows:Row[]}){const [search,setSearch]=useState('');const normalized=rows.filter(r=>productKey(r.product_key).includes(productKey(search)));return <section className="panel"><h2>Histórico de preços por unidade</h2><input aria-label="Pesquisar produto" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Produto padronizado"/><p className="small">Compare somente o mesmo produto, marca e unidade. Quantidades em gramas e mililitros devem ser convertidas para kg e l no cadastro.</p><div className="table-wrap"><table><thead><tr><th>Produto</th><th>Marca</th><th>Loja</th><th>Data</th><th>Quantidade</th><th>Total</th><th>Preço / unidade</th></tr></thead><tbody>{normalized.slice().sort((a,b)=>productKey(a.product_key).localeCompare(productKey(b.product_key))||a.unit.localeCompare(b.unit)||Number(a.total_cents)/Number(a.quantity)-Number(b.total_cents)/Number(b.quantity)).map(r=><tr key={r.id}><td>{r.product_key}</td><td>{r.brand}</td><td>{r.merchant}</td><td>{r.purchased_on}</td><td>{r.quantity} {r.unit}</td><td>{money(Number(r.total_cents))}</td><td>{money(Number(r.total_cents)/Number(r.quantity))}/{r.unit}</td></tr>)}</tbody></table></div></section>;}
function CardInstallments({data}:{data:Snapshot}){const schedule=cardSchedule(data).filter(row=>row.due_on>=today());return <section className="panel"><h2>Parcelamentos futuros</h2><p className="small">Para criar um parcelamento: Registrar gasto → Cartão de crédito → informe o número de parcelas. O sistema divide o total em centavos, respeita o limite e inclui cada parcela na fatura correta.</p><div className="table-wrap"><table><thead><tr><th>Compra</th><th>Cartão</th><th>Parcela</th><th>Vencimento</th><th>Valor</th></tr></thead><tbody>{schedule.slice(0,120).map(row=><tr key={row.id}><td>{row.transaction.description}</td><td>{active(data,'cards').find(card=>card.id===row.card_id)?.name??'Cartão removido'}</td><td>{row.number}ª</td><td>{row.due_on}</td><td>{money(Number(row.amount_cents))}</td></tr>)}</tbody></table></div>{!schedule.length&&<p>Nenhuma parcela futura. Cadastre uma compra no cartão para vê-la aqui.</p>}</section>;}
function ImportCSV({data,onPost}:{data:Snapshot;onPost:(p:any,id?:string)=>Promise<void>}){const [rows,setRows]=useState<any[]>([]),[error,setError]=useState(''),[account,setAccount]=useState(''),[busy,setBusy]=useState(false);const fingerprints=new Set(posted(data).map(fingerprint));return <section className="panel"><h2>Importar extrato CSV</h2><p>Colunas: data (AAAA-MM-DD), descricao, valor (negativo = despesa), categoria (opcional). Revise antes de confirmar. Importação pessoal.</p><select aria-label="Conta do extrato" value={account} onChange={e=>setAccount(e.target.value)}><option value="">Selecione a conta</option>{active(data,'accounts').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><input type="file" accept=".csv,text/csv" onChange={async e=>{setError('');try{const file=e.target.files?.[0];if(!file)return;if(file.size>2e6)throw Error('Limite: 2 MB por CSV.');const result=parseCSV(await file.text()).map(r=>{const value=cents(r.valor??'');if(!/^\d{4}-\d{2}-\d{2}$/.test(r.data??'')||!r.descricao||value===0)throw Error('Revise data, descrição e valor do CSV.');return {kind:value<0?'expense':'income',scope:'personal',description:r.descricao,amount_cents:Math.abs(value),occurred_on:r.data,category:r.categoria||'Outros'};});const seen=new Set(fingerprints);setRows(result.map(r=>{const duplicate=seen.has(fingerprint(r));seen.add(fingerprint(r));return {...r,duplicate,selected:!duplicate,operationId:crypto.randomUUID()};}));}catch(e){setError(message(e));}}}/>
 {rows.map((r,i)=><label className="check" key={i}><input type="checkbox" checked={r.selected} onChange={e=>setRows(old=>old.map((x,j)=>i===j?{...x,selected:e.target.checked}:x))}/>{r.occurred_on} · {r.description} · {money(r.amount_cents)} {r.duplicate?'(possível duplicata)':''}</label>)}
 {error&&<p role="alert">{error}</p>}{rows.length>0&&<button disabled={!account||busy} onClick={async()=>{setBusy(true);setError('');try{for(let i=0;i<rows.length;i++){const r=rows[i];if(!r.selected)continue;const {selected,duplicate,operationId,...payload}=r;await onPost({...payload,account_id:account},operationId);setRows(old=>old.map((x,j)=>i===j?{...x,selected:false}:x));}setRows([]);}catch(e){setError(message(e));}finally{setBusy(false);}}}>{busy?'Importando…':'Confirmar selecionados'}</button>}</section>;}
function Documents({data,api,access,save,refresh,onTransaction,onItem}:{data:Snapshot;api:FinanceAPI;access:Ready;save:(t:string,d:any,r?:Row)=>Promise<void>;refresh:()=>Promise<void>;onTransaction:(p:any)=>void;onItem:(r:Row)=>void}){
 const [file,setFile]=useState<File>(),scope='family',[busy,setBusy]=useState(false),[error,setError]=useState(''),[text,setText]=useState(''),[progress,setProgress]=useState(''),[qr,setQr]=useState(''),[suggestion,setSuggestion]=useState<any>(),[selectedDocId,setSelectedDocId]=useState(''),[storedDoc,setStoredDoc]=useState<Row>(),[restored,setRestored]=useState(false);
 useEffect(()=>{
  let mounted=true,timeout:ReturnType<typeof setTimeout>|undefined;
  // Pede armazenamento persistente quando o navegador permitir, reduzindo a
  // chance de o Android limpar a foto pendente ao abrir câmera/galeria.
  void navigator.storage?.persist?.().catch(()=>false);
  // Some Android browsers briefly recreate the page after closing the photo
  // picker. Retry a few times so a draft being written at that exact moment is
  // still restored instead of silently disappearing.
  const restore=async(attempt=0):Promise<void>=>{
   const draft=await localDB.uploadDrafts.get(uploadDraftId(access.userId));
   if(!mounted)return;
   if(draft){setFile(new File([draft.file],draft.filename,{type:draft.mimeType}));setRestored(true);return;}
   if(attempt<4)timeout=setTimeout(()=>void restore(attempt+1),[120,300,700,1400][attempt]);
  };
  void restore();
  return()=>{mounted=false;clearTimeout(timeout);};
 },[access.userId]);
 useEffect(()=>{if(file)void localDB.uploadDrafts.update(uploadDraftId(access.userId),{scope});},[file,scope,access.userId]);
 async function selectFile(next?:File){
  setError('');if(!next)return;
  if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(next.type)||next.size>10485760){setError('Envie JPEG, PNG, WebP ou PDF de até 10 MB.');return;}
  setSelectedDocId('');setStoredDoc(undefined);setText('');setQr('');setSuggestion(undefined);setRestored(false);
  try{await localDB.uploadDrafts.put({id:uploadDraftId(access.userId),userId:access.userId,file:next,filename:next.name,mimeType:next.type,scope,createdAt:Date.now()});}catch{setError('A foto foi selecionada, mas não foi possível guardá-la neste aparelho. Envie-a sem fechar a página.');}finally{setFile(next);}
 }
 async function run(fn:()=>Promise<void|Row|undefined>){setBusy(true);setError('');try{await fn();}catch(e){setError(message(e));}finally{setBusy(false);setProgress('');}}
 async function upload(details?:{merchant?:string;date?:string}):Promise<Row|undefined>{if(!file)return;if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10485760)throw Error('Envie JPEG, PNG, WebP ou PDF de até 10 MB.');
 const hash=await checksum(file);let doc=data.documents.find(d=>d.checksum===hash&&d.owner_user_id===access.userId&&!d.archived);
 if(doc?.upload_status==='ready')throw Error('Este documento já está salvo. Abra-o na lista.');
 if(!doc){doc={id:crypto.randomUUID(),household_id:access.householdId,owner_user_id:access.userId,scope,filename:purchaseFilename(file,details?.merchant,details?.date),mime_type:file.type,size_bytes:file.size,checksum:hash,version:1};await api.save('documents',doc);}
 try{await api.upload(doc.id,file);}catch(e){try{const existing=await api.download(doc.id);const recovered=new File([existing],file.name,{type:file.type});if(await checksum(recovered)!==hash)throw e;}catch{throw e;}}
 const readyDoc={...doc,upload_status:'ready',version:Number(doc.version??1)+1};await api.save('documents',{id:doc.id,upload_status:'ready'},doc.version);await localDB.uploadDrafts.delete(uploadDraftId(access.userId));setSelectedDocId(doc.id);setStoredDoc(readyDoc);await refresh();setFile(undefined);setRestored(false);return readyDoc;
 }
 async function discardDraft(){await localDB.uploadDrafts.delete(uploadDraftId(access.userId));setFile(undefined);setText('');setQr('');setSuggestion(undefined);setError('');setRestored(false);}
 const currentDoc=storedDoc??active(data,'documents').find(d=>d.id===selectedDocId&&d.owner_user_id===access.userId);
 const matchingExpenses=suggestion?.total?posted(data).filter(row=>row.kind==='expense'&&row.owner_user_id===access.userId&&Number(row.amount_cents)===cents(suggestion.total)).sort((a,b)=>Number(b.occurred_on===suggestion.date)-Number(a.occurred_on===suggestion.date)):[];
 return <><section className="panel"><h2>Enviar nota ou documento</h2><input aria-label="Imagem ou PDF da nota" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event=>{const selected=event.currentTarget.files?.[0];event.currentTarget.value='';void selectFile(selected);}}/>{file&&<p className="small">Arquivo selecionado: {file.name}{restored?' · recuperado deste aparelho':''}</p>}<p className="small">Escolha “Câmera” ou “Arquivos” no seletor do celular. A foto fica como rascunho neste aparelho até você concluir.</p><div className="toolbar"><button type="button" disabled={!file||file.type==='application/pdf'||busy} onClick={()=>void run(async()=>{if(!file)return;setProgress('Preparando e identificando produtos…');const analysisFile=await prepareImageForAI(file,setProgress);const result=analysisFromAI(await api.analyzeReceiptWithAI(analysisFile));setText(result.text);setSuggestion(result);})}>✨ Ler e organizar compra</button><button type="button" className="quiet" disabled={!file||busy} onClick={()=>void run(upload)}>Só guardar arquivo</button><button type="button" className="quiet" disabled={!file||file.type==='application/pdf'||busy} onClick={()=>void run(async()=>{if(!file)return;setProgress('Lendo QR Code…');setQr(await readQR(file));})}>Ler QR Code</button>{file&&!currentDoc&&<button type="button" className="quiet" disabled={busy} onClick={()=>void discardDraft()}>Descartar rascunho</button>}</div><details className="quick-details"><summary>Diagnóstico / leitura local</summary><button type="button" className="quiet" disabled={!file||busy} onClick={()=>void run(async()=>{if(!file)return;const s=await recognize(file,setProgress);setText(s.text);setSuggestion(s);})}>Ler no aparelho</button>{text&&<textarea rows={10} value={text} onChange={e=>setText(e.target.value)}/>}</details><p className="small">Ler por IA, QR Code e diagnóstico não criam documento no histórico. Revise e confirme para guardar.</p>{progress&&<p role="status">{progress}</p>}{error&&<p role="alert" className="error">{error}</p>}{suggestion&&<>{suggestion.productsConsistent?<p role="status">Itens e total conferem. A nota continua somente como rascunho até a confirmação.</p>:<p role="alert" className="error">Os itens lidos não conferem com o total. Corrija ou descarte o rascunho; nada será registrado automaticamente.</p>}{currentDoc&&<label>Esta nota é de qual gasto já lançado?<select value={currentDoc.transaction_id??''} onChange={event=>void run(async()=>{const transaction_id=event.target.value||null;await save('documents',{transaction_id},currentDoc);setStoredDoc({...currentDoc,transaction_id,version:Number(currentDoc.version)+1});})}><option value="">Ainda não vincular</option>{matchingExpenses.map(row=><option key={row.id} value={row.id}>{row.occurred_on} · {row.description} · {money(Number(row.amount_cents))}</option>)}</select></label>}<div className="toolbar"><button type="button" className="quiet" onClick={()=>{let amount;try{amount=cents(suggestion.total);}catch{amount=undefined;}onTransaction({description:'Compra '+(suggestion.merchant??''),merchant:suggestion.merchant,occurred_on:suggestion.date||today(),amount_cents:amount,scope,kind:'expense'});}}>Criar gasto desta nota</button></div></>}</section>
 {suggestion?.productsConsistent&&<ReceiptReview products={suggestion.products} expectedTotalCents={cents(suggestion.total)} document={currentDoc} merchant={suggestion?.merchant??''} date={suggestion?.date??today()} data={data} save={save} onSaveDocument={()=>upload({merchant:suggestion?.merchant,date:suggestion?.date})}/>} 
 <ReceiptBatchUpload api={api} access={access} data={data} refresh={refresh}/>
 <div className="record-grid">{active(data,'documents').map(doc=><article className="panel" key={doc.id}><h2>{doc.filename}</h2><p>{(doc.size_bytes/1024).toFixed(0)} KB · Compartilhado · {doc.upload_status==='ready'?'Armazenado':'Upload pendente — selecione o mesmo arquivo para retomar'}</p>{doc.upload_status==='ready'&&<button onClick={()=>void run(async()=>downloadBlob(await api.download(doc.id),doc.filename))}>Baixar</button>}{doc.owner_user_id===access.userId&&<><button className="secondary" onClick={()=>onItem(doc)}>Cadastrar produto da nota</button><form onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);void run(()=>save('documents',{warranty_until:form.get('warranty_until')||null,notes:form.get('notes')},doc));}}><label>Garantia até<input type="date" name="warranty_until" defaultValue={doc.warranty_until??''}/></label><label>Observações<textarea name="notes" defaultValue={doc.notes??''}/></label><button disabled={busy}>Salvar garantia / observações</button></form></>}</article>)}</div></>;
}
async function backup(data:Snapshot,api:FinanceAPI){
 const password=prompt('Defina uma senha de pelo menos 12 caracteres para criptografar a cópia. Guarde-a: sem ela não será possível recuperar o arquivo.');
 if(password===null)return;if(password.length<12)throw Error('Use pelo menos 12 caracteres.');
 const docs=active(data,'documents').filter(d=>d.upload_status==='ready');if(docs.reduce((n,d)=>n+Number(d.size_bytes),0)>150e6)throw Error('Acima de 150 MB, exporte os documentos individualmente para evitar falta de memória.');
 const {default:JSZip}=await import('jszip');const zip=new JSZip();zip.file('dados.json',JSON.stringify({version:1,exportedAt:new Date().toISOString(),data},null,2));
 for(const d of docs)zip.file('documents/'+d.id,await (await api.download(d.id)).arrayBuffer());
 const bytes=await zip.generateAsync({type:'uint8array'}),salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt']);
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,bytes as BufferSource);
 downloadBlob(new Blob([new TextEncoder().encode('NCBK1'),salt,iv,encrypted]),'nossa-casa-backup.ncb');
}
function Control({data,api,access,save,refresh}:{data:Snapshot;api:FinanceAPI;access:Ready;save:(t:string,d:any,r?:Row)=>Promise<void>;refresh:()=>Promise<void>}){
 const [password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const docs=active(data,'documents'),bytes=docs.reduce((total,doc)=>total+Number(doc.size_bytes||0),0),photos=docs.filter(doc=>String(doc.mime_type).startsWith('image/')).length;
 async function remove(doc:Row){
  if(!password)return setError('Informe a senha atual para apagar um documento.');
  if(!confirm(`Apagar permanentemente o arquivo “${doc.filename}”? Esta ação libera o espaço usado e não pode ser desfeita.`))return;
  setBusy(true);setError('');try{await api.removeDocument(doc.id,password);await save('documents',{archived:true,upload_status:'deleted'},doc);setPassword('');await refresh();}catch(e){setError(message(e));}finally{setBusy(false);}
 }
 return <section className="panel"><h2>Controle do sistema</h2><p>Dados compartilhados da família, visíveis apenas para usuários autenticados.</p><div className="metrics"><Metric title="Documentos ativos" value={String(docs.length)}/><Metric title="Fotos" value={String(photos)}/><Metric title="Espaço dos documentos" value={`${(bytes/1024/1024).toFixed(2)} MB`}/><Metric title="Lançamentos" value={String(active(data,'transactions').length)}/></div><p className="small">Este é o uso dos documentos deste aplicativo. A cota total do Supabase também pode incluir outros projetos e é administrada no painel do Supabase.</p><label>Senha atual para apagar arquivos<input type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password"/></label>{error&&<p role="alert" className="error">{error}</p>}<div className="record-grid">{docs.map(doc=><article className="panel" key={doc.id}><strong>{doc.filename}</strong><p>{(Number(doc.size_bytes)/1024).toFixed(0)} KB · {doc.mime_type}</p><button className="danger" disabled={busy} onClick={()=>void remove(doc)}>Apagar arquivo</button></article>)}</div>{!docs.length&&<p>Nenhum documento guardado.</p>}</section>;
}
function BackupVerifier(){
 const [file,setFile]=useState<File>(),[password,setPassword]=useState(''),[status,setStatus]=useState(''),[zip,setZip]=useState<Blob>();
 async function verify(){
  if(!file||password.length<12)throw Error('Selecione o backup e informe a senha de pelo menos 12 caracteres.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(new TextDecoder().decode(bytes.slice(0,5))!=='NCBK1'||bytes.length<34)throw Error('Arquivo de backup inválido.');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes.slice(5,21),iterations:250000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  let plain:ArrayBuffer;try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(21,33)},key,bytes.slice(33));}catch{throw Error('Senha incorreta ou backup corrompido.');}
  const blob=new Blob([plain],{type:'application/zip'}),{default:JSZip}=await import('jszip'),archive=await JSZip.loadAsync(plain),manifest=archive.file('dados.json');
  if(!manifest)throw Error('Backup sem manifesto de dados.');
  const data=JSON.parse(await manifest.async('text'));
  if(data.version!==1||!data.data?.transactions||!data.data?.documents)throw Error('Formato de backup não reconhecido.');
  const documentCount=Object.keys(archive.files).filter(name=>name.startsWith('documents/')&&!archive.files[name].dir).length;
  setZip(blob);setStatus(`Backup íntegro: ${data.data.transactions.length} lançamentos e ${documentCount} documentos. Exportado em ${new Date(data.exportedAt).toLocaleString('pt-BR')}.`);
 }
 return <details><summary>Verificar se um backup pode ser aberto</summary><p className="small">A verificação ocorre somente neste navegador e não altera o banco. A restauração administrativa deve ser ensaiada antes de usar dados reais.</p><input aria-label="Arquivo de backup" type="file" accept=".ncb,application/octet-stream" onChange={e=>{setFile(e.target.files?.[0]);setStatus('');setZip(undefined);}}/><label>Senha do backup<input type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)}/></label><button onClick={()=>void verify().catch(e=>setStatus(message(e)))}>Verificar backup</button>{status&&<p role="status">{status}</p>}{zip&&<button className="quiet" onClick={()=>downloadBlob(zip,'nossa-casa-backup-verificado.zip')}>Baixar conteúdo verificado</button>}</details>;
}

