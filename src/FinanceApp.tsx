import {useState,useEffect,useCallback,useRef,type ReactNode} from 'react';
import type {Ready} from './access';
import type {FinanceAPI} from './finance';
import {active,balance,cents,emptySnapshot,fingerprint,invoices,money,monthDay,normalizeUnit,posted,productKey,summary,today,type Row,type Snapshot} from './domain';
import {localDB,cacheId,enqueue,pendingFor,syncPending,uploadDraftId,type Pending} from './offline';
import {ResourceEditor,type Field} from './ResourceEditor';
import {TransactionForm} from './TransactionForm';
import {downloadBlob,exportData,exportReport,parseCSV} from './exports';
import {checksum,readQR,recognize} from './receipts';
import {enableNotifications,notificationsAvailable,notifyDueItems} from './notifications';
import {ReceiptReview} from './ReceiptReview';
import {ReceiptBatchUpload} from './ReceiptBatchUpload';
import {SetupGuide,seededCategoryRows} from './onboarding';
const labels:Record<string,string>={dashboard:'Visão geral',transactions:'Lançamentos',accounts:'Contas',cards:'Cartões',due_items:'Contas a vencer',shopping_items:'Lista de compras',documents:'Notas e documentos',budgets:'Orçamentos',goals:'Metas e reservas',assets:'Patrimônio',receipt_items:'Produtos e preços',reports:'Relatórios',recurring_rules:'Recorrências',categories:'Categorias',sync:'Sincronização',control:'Controle',profile:'Meu perfil',audit_events:'Histórico'};
const baseFields:Record<string,Field[]>={
 accounts:[{key:'name',label:'Nome da conta'},{key:'opening_cents',label:'Saldo inicial (R$)',type:'money',default:'0'}],
 cards:[{key:'name',label:'Nome do cartão'},{key:'limit_cents',label:'Limite (R$)',type:'money'},{key:'closing_day',label:'Dia de fechamento',type:'number'},{key:'due_day',label:'Dia de vencimento',type:'number'}],
 categories:[{key:'name',label:'Categoria'},{key:'parent_name',label:'Categoria principal (opcional)',optional:true}],
 budgets:[{key:'month',label:'Primeiro dia do mês',type:'date',default:today().slice(0,7)+'-01'},{key:'category',label:'Categoria'},{key:'limit_cents',label:'Limite (R$)',type:'money'}],
 goals:[{key:'name',label:'Objetivo'},{key:'target_cents',label:'Meta (R$)',type:'money'},{key:'due_on',label:'Prazo (opcional)',type:'date',optional:true}],
 assets:[{key:'name',label:'Bem'},{key:'value_cents',label:'Valor registrado (R$)',type:'money'},{key:'acquired_on',label:'Data de aquisição',type:'date',optional:true},{key:'notes',label:'Observações',type:'textarea',optional:true}],
 due_items:[{key:'description',label:'Descrição'},{key:'amount_cents',label:'Valor (R$)',type:'money'},{key:'category',label:'Categoria',default:'Moradia'},{key:'due_on',label:'Vencimento',type:'date'}],
 recurring_rules:[{key:'description',label:'Descrição'},{key:'amount_cents',label:'Valor (R$)',type:'money'},{key:'category',label:'Categoria',default:'Moradia'},{key:'day',label:'Dia do mês',type:'number'},{key:'start_on',label:'Início',type:'date',default:today()},{key:'end_on',label:'Fim (opcional)',type:'date',optional:true}],
 shopping_items:[{key:'name',label:'Produto'},{key:'quantity',label:'Quantidade',type:'number',default:'1'},{key:'unit',label:'Unidade',default:'un'}]
};
const sharedScopeTables=new Set(['categories','budgets','goals','goal_contributions','assets','due_items','recurring_rules','shopping_items','documents','receipt_items']);
async function stableId(value:string){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const h=[...bytes.slice(0,16)].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
export function FinanceApp({api,access,profile}:{api:FinanceAPI;access:Ready;profile:ReactNode}){
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
 function newEditor(table:string,row?:Row){setEditor({table,row});}
 async function archive(table:string,row:Row){if(!confirm('Arquivar este registro? Ele continuará preservado no histórico.'))return;await save(table,{archived:true},row);}
 const filtered=active(data,page).filter(r=>!search||String(r.name??r.description??r.product_key??r.filename??'').toLowerCase().includes(search.toLowerCase()));
 const nav=simple?['dashboard','transactions','shopping_items','documents','control','profile']:Object.keys(labels);
 return <div className="workspace">
 <div className="workspace-top"><div><p className="eyebrow">{access.householdName}</p><h1>{labels[page]}</h1></div><button onClick={()=>setTransaction({})}>+ Registrar gasto</button></div>
 <div className="toolbar"><label className="check"><input type="checkbox" checked={simple} onChange={e=>{setSimple(e.target.checked);localStorage.setItem('simple:'+access.userId,String(e.target.checked));setPage('dashboard');}}/>Modo simples</label><span className="badge">{offline?'Offline · dados deste aparelho':'Conectado'}</span><button className="quiet" onClick={()=>{setPage('sync');}}>Fila: {pending.length}</button><button className="quiet" onClick={()=>void load()}>Atualizar</button></div>
 <nav aria-label="Módulos">{nav.map(key=><button key={key} className={page===key?'selected':'quiet'} onClick={()=>{setPage(key);setSearch('');}}>{labels[key]}</button>)}</nav>
 {error&&<p role="alert" className="banner error">{error}</p>}{notice&&<p role="status" className="banner">{notice}<button className="quiet" onClick={()=>setNotice('')}>Fechar</button></p>}
 {offline&&<p className="banner">Você está vendo uma cópia local. Novos lançamentos ficam pendentes até a confirmação do servidor.</p>}
 {transaction&&<TransactionForm key={JSON.stringify(transaction)} snapshot={data} initial={transaction} simple={simple&&!transaction.due_item_id} onSave={post} onClose={()=>setTransaction(null)}/>}
 {editor&&<ResourceEditor title={(editor.row?'Editar ':'Novo registro · ')+(labels[editor.table]??editor.table)} fields={editor.fields??baseFields[editor.table]} initial={editor.row} allowScope={false} onSave={values=>save(editor.table,{...values,...editor.extra},editor.row)} onClose={()=>setEditor(null)}/>}
 {loading?<p role="status">Carregando seus dados…</p>:<>
 {['dashboard','transactions','reports'].includes(page)&&<div className="filters"><label>Mês<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><label>Pesquisar<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Descrição, categoria ou loja"/></label></div>}
 {page==='dashboard'&&<>
 <SetupGuide snapshot={data} onSeedCategories={seedCategories} onOpen={table=>{if(table==='transactions'){setTransaction({});return;}setPage(table);setSearch('');}}/>
 <div className="metrics"><Metric title="Receitas" value={money(totals.income)}/><Metric title="Despesas" value={money(totals.expense)}/><Metric title="Resultado do período" value={money(totals.income-totals.expense)}/><Metric title="Saldo das minhas contas" value={money(active(data,'accounts').reduce((n,a)=>n+balance(data,a),0))}/></div>
 <p className="small">Despesas por data da compra. Pagamentos de fatura e transferências não entram novamente nas despesas.</p>
 <section className="panel"><h2>Despesas por pagador</h2><p>Você: {money(rows.filter(r=>r.kind==='expense'&&own(r)).reduce((n,r)=>n+Number(r.amount_cents),0))}</p><p>Outro membro: {money(rows.filter(r=>r.kind==='expense'&&!own(r)).reduce((n,r)=>n+Number(r.amount_cents),0))}</p><p className="small">Comparativo informativo. Não gera dívidas entre vocês.</p></section>
 <section className="panel"><h2>Gastos por categoria</h2><CategoryChart rows={rows}/></section>
 <section className="panel"><h2>Contas que precisam de atenção</h2>{due.length?due.map(r=><p key={r.id}>{r.description} · {r.due_on} · {money(Number(r.amount_cents))}</p>):<p>Nenhuma conta vencida cadastrada.</p>}<div className="toolbar"><button className="quiet" onClick={()=>setPage('due_items')}>Ver contas a vencer</button>{notificationsAvailable()&&<button className="quiet" onClick={()=>void action(async()=>{if(!await enableNotifications())throw Error('As notificações foram bloqueadas neste aparelho.');const sent=notifyDueItems(due);setNotice(sent?'Lembretes ativados neste aparelho.':'Não há lembretes novos para enviar.');})}>Ativar lembretes</button>}</div></section>
 </>}
 {page==='transactions'&&<TransactionList rows={rows} userId={access.userId} onVoid={r=>action(async()=>{if(confirm('Estornar este lançamento? O histórico será preservado.'))await post({action:'void',transaction_id:r.id,version:r.version});})}/>}
 {baseFields[page]&&<>
 <div className="toolbar"><button onClick={()=>newEditor(page)}>Adicionar</button><input aria-label="Pesquisar registros" placeholder="Pesquisar…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
 {page==='recurring_rules'&&<p className="banner">Ao abrir ou sincronizar o app, as recorrências geram contas até dois meses à frente. Elas só alteram o saldo quando você registra o pagamento.</p>}
 <div className="record-grid">{filtered.map(r=><article className="panel" key={r.id}><div className="row spread"><h2>{r.name??r.description??r.category}</h2>{r.scope&&<span className="badge">Compartilhado</span>}</div>
 {page==='accounts'&&<strong className="amount">{money(balance(data,r))}</strong>}
 {page==='cards'&&<><p>Limite: {money(Number(r.limit_cents))}</p><p>Comprometido: {money(invoices(data).filter(i=>i.card_id===r.id).reduce((n,i)=>n+i.total-i.paid,0))}</p><p>Fechamento: dia {r.closing_day} · Vencimento: dia {r.due_day}</p></>}
 {page==='assets'&&<><strong>{money(Number(r.value_cents))}</strong><p>{r.notes}</p></>}
 {page==='budgets'&&<Budget row={r} data={data}/>}
 {page==='goals'&&<><Goal row={r} data={data}/>{own(r)&&<button className="quiet" onClick={()=>setEditor({table:'goal_contributions',fields:[{key:'amount_cents',label:'Contribuição (R$)',type:'money'},{key:'occurred_on',label:'Data',type:'date',default:today()}],extra:{goal_id:r.id}})}>Registrar contribuição</button>}<p className="small">Contribuições acompanham a reserva; não debitam uma conta automaticamente.</p></>}
 {page==='due_items'&&<><p>{r.due_on} · {money(Number(r.amount_cents))}</p><span className="badge">{r.paid_transaction_id?'Paga':r.due_on<today()?'Vencida':'A vencer'}</span>{own(r)&&!r.paid_transaction_id&&<button onClick={()=>setTransaction({...r,kind:'expense',due_item_id:r.id,occurred_on:today()})}>Registrar pagamento</button>}</>}
 {page==='recurring_rules'&&<p>{money(Number(r.amount_cents))} · todo dia {r.day} · desde {r.start_on}</p>}
 {page==='shopping_items'&&<><p>{r.quantity} {r.unit}</p><label className="check"><input type="checkbox" checked={r.purchased} onChange={e=>void action(()=>save(page,{purchased:e.target.checked},r))}/>Comprado</label></>}
 {own(r)&&<div className="toolbar"><button className="quiet" onClick={()=>newEditor(page,r)}>Editar</button><button className="quiet danger" onClick={()=>void action(()=>archive(page,r))}>Arquivar</button></div>}
 </article>)}</div>{!filtered.length&&<Empty/>}
 {page==='accounts'&&<ImportCSV data={data} onPost={post}/>}
 {page==='cards'&&<section className="panel"><h2>Faturas e compromissos futuros</h2><div className="table-wrap"><table><thead><tr><th>Cartão</th><th>Vencimento</th><th>Total</th><th>Pago</th><th>Restante</th><th>Ação</th></tr></thead><tbody>{invoices(data).map(i=><tr key={i.id}><td>{data.cards.find(c=>c.id===i.card_id)?.name}</td><td>{i.due_on}</td><td>{money(i.total)}</td><td>{money(i.paid)}</td><td>{money(i.total-i.paid)}</td><td>{i.total>i.paid&&<button onClick={()=>setTransaction({kind:'card_payment',card_id:i.card_id,due_on:i.due_on,amount_cents:i.total-i.paid,description:'Pagamento de fatura'})}>Pagar</button>}</td></tr>)}</tbody></table></div></section>}
 </>}
 {page==='documents'&&<Documents data={data} api={api} access={access} save={save} refresh={load} onTransaction={setTransaction} onItem={doc=>setEditor({table:'receipt_items',fields:[{key:'product_key',label:'Produto padronizado (ex.: arroz branco 1kg)'},{key:'brand',label:'Marca',optional:true},{key:'quantity',label:'Quantidade total em un, kg ou l',type:'number'},{key:'unit',label:'Unidade normalizada',type:'select',options:['un','kg','l'].map(value=>({value,label:value}))},{key:'total_cents',label:'Preço total (R$)',type:'money'},{key:'merchant',label:'Loja',optional:true},{key:'purchased_on',label:'Data',type:'date',default:today()}],extra:{document_id:doc.id}})}/>}
 {page==='control'&&<Control data={data} api={api} access={access} save={save} refresh={load}/>} 
 {page==='receipt_items'&&<Products rows={active(data,'receipt_items')}/>}
 {page==='reports'&&<><div className="metrics"><Metric title="Receitas" value={money(totals.income)}/><Metric title="Despesas" value={money(totals.expense)}/></div><div className="toolbar">{(['csv','xlsx','pdf'] as const).map(format=><button key={format} onClick={()=>void action(()=>exportReport(rows,format))}>Exportar {format.toUpperCase()}</button>)}<button className="quiet" onClick={()=>{setMonth('');}}>Todos os períodos</button></div><section className="panel"><h2>Evolução mensal</h2><Monthly rows={posted(data)}/></section><section className="panel"><h2>Por estabelecimento</h2><CategoryChart rows={rows} field="merchant"/></section><TransactionList rows={rows} userId={access.userId}/></>}
 {page==='audit_events'&&<section className="panel"><h2>Histórico dos meus registros</h2>{data.audit_events.slice().sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(r=><details key={r.id}><summary>{new Date(r.created_at).toLocaleString('pt-BR')} · {r.action}</summary><pre>{JSON.stringify(r.details,null,2)}</pre></details>)}</section>}
 {page==='sync'&&<section className="panel"><h2>Pendências deste aparelho</h2><p>Os lançamentos ficam nesta fila até serem confirmados. Erros de autorização ou conflitos exigem revisão; o app não altera valores automaticamente.</p>{pending.map(p=><article key={p.id} className="pending"><strong>{p.payload.description??'Estorno'}</strong><p>{p.error??'Aguardando envio'}</p><div className="toolbar"><button onClick={()=>void action(async()=>{await localDB.outbox.update(p.id,{error:undefined});await load();})}>Tentar novamente</button><button className="quiet" onClick={()=>downloadBlob(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),'lancamento-pendente.json')}>Exportar</button><button className="quiet danger" onClick={()=>void action(async()=>{if(confirm('Descartar este lançamento pendente?')){await localDB.outbox.delete(p.id);await load();}})}>Descartar</button></div></article>)}{!pending.length&&<p>Tudo sincronizado.</p>}<button onClick={()=>void load()}>Sincronizar agora</button><h2>Cópia dos meus dados</h2><p>Exporta somente o que esta conta pode ler. Cada pessoa deve exportar seus próprios dados privados.</p><button onClick={()=>exportData(data)}>Exportar JSON</button><button className="secondary" onClick={()=>void action(async()=>{await backup(data,api);})}>Backup criptografado com documentos</button><BackupVerifier/><p className="small">Os dados offline ficam no armazenamento deste aparelho. Use bloqueio de tela e evite aparelhos compartilhados. Ao sair, o cache local é apagado. Se houver lançamentos pendentes, a saída é bloqueada até você sincronizar, exportar ou descartar a fila.</p></section>}
 {page==='profile'&&profile}
 </>}
 </div>;
}
function message(e:unknown){return e instanceof Error?e.message:'Não foi possível concluir. Tente novamente.';}
function Empty(){return <p className="empty">Nenhum registro ainda. Use Adicionar para começar.</p>;}
function Metric({title,value}:{title:string;value:string}){return <div className="metric"><span>{title}</span><strong>{value}</strong></div>;}
function CategoryChart({rows,field='category'}:{rows:Row[];field?:string}){const groups=new Map<string,number>();rows.filter(r=>r.kind==='expense').forEach(r=>groups.set(r[field]||'Não informado',(groups.get(r[field]||'Não informado')??0)+Number(r.amount_cents)));const max=Math.max(1,...groups.values());return <div>{[...groups].sort((a,b)=>b[1]-a[1]).map(([name,value])=><div className="chart-row" key={name}><span>{name}</span><meter min="0" max={max} value={value}/><strong>{money(value)}</strong></div>)}{!groups.size&&<p>Nenhuma despesa neste período.</p>}</div>;}
function Monthly({rows}:{rows:Row[]}){const months=[...new Set(rows.map(r=>r.occurred_on.slice(0,7)))].sort();return <table><thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Resultado</th></tr></thead><tbody>{months.map(m=>{const t=summary(rows.filter(r=>r.occurred_on.startsWith(m)));return <tr key={m}><td>{m}</td><td>{money(t.income)}</td><td>{money(t.expense)}</td><td>{money(t.income-t.expense)}</td></tr>;})}</tbody></table>;}
function TransactionList({rows,userId,onVoid}:{rows:Row[];userId:string;onVoid?:(r:Row)=>void}){return <section className="panel"><div className="table-wrap"><table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Pagador</th><th>Valor</th><th>Tipo</th><th/></tr></thead><tbody>{rows.slice().sort((a,b)=>b.occurred_on.localeCompare(a.occurred_on)).map(r=><tr key={r.id}><td>{r.occurred_on}</td><td>{r.description}<small>{r.merchant} · Compartilhado</small></td><td>{r.category}</td><td>{r.owner_user_id===userId?'Você':'Outro membro'}</td><td>{money(Number(r.amount_cents))}</td><td>{{expense:'Despesa',income:'Receita',transfer:'Transferência',card_payment:'Fatura'}[r.kind as string]??r.kind}</td><td>{onVoid&&r.owner_user_id===userId&&<button className="quiet" onClick={()=>onVoid(r)}>Estornar</button>}</td></tr>)}</tbody></table></div>{!rows.length&&<Empty/>}</section>;}
function Budget({row,data}:{row:Row;data:Snapshot}){const used=posted(data).filter(t=>t.kind==='expense'&&t.occurred_on.startsWith(row.month.slice(0,7))&&t.category===row.category).reduce((n,r)=>n+Number(r.amount_cents),0);return <><p>{row.month.slice(0,7)} · {money(used)} de {money(Number(row.limit_cents))}</p><meter min="0" max={row.limit_cents} value={used}/><p>Disponível: {money(Number(row.limit_cents)-used)}</p></>;}
function Goal({row,data}:{row:Row;data:Snapshot}){const saved=active(data,'goal_contributions').filter(c=>c.goal_id===row.id).reduce((n,c)=>n+Number(c.amount_cents),0);return <><p>{money(saved)} de {money(Number(row.target_cents))}</p><meter min="0" max={row.target_cents} value={saved}/><p>{row.due_on&&'Prazo: '+row.due_on}</p><details><summary>Contribuições</summary>{active(data,'goal_contributions').filter(c=>c.goal_id===row.id).map(c=><p key={c.id}>{c.occurred_on} · {money(Number(c.amount_cents))}</p>)}</details></>;}
function Products({rows}:{rows:Row[]}){const [search,setSearch]=useState('');const normalized=rows.filter(r=>productKey(r.product_key).includes(productKey(search)));return <section className="panel"><h2>Histórico de preços por unidade</h2><input aria-label="Pesquisar produto" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Produto padronizado"/><p className="small">Compare somente o mesmo produto, marca e unidade. Quantidades em gramas e mililitros devem ser convertidas para kg e l no cadastro.</p><div className="table-wrap"><table><thead><tr><th>Produto</th><th>Marca</th><th>Loja</th><th>Data</th><th>Quantidade</th><th>Total</th><th>Preço / unidade</th></tr></thead><tbody>{normalized.slice().sort((a,b)=>productKey(a.product_key).localeCompare(productKey(b.product_key))||a.unit.localeCompare(b.unit)||Number(a.total_cents)/Number(a.quantity)-Number(b.total_cents)/Number(b.quantity)).map(r=><tr key={r.id}><td>{r.product_key}</td><td>{r.brand}</td><td>{r.merchant}</td><td>{r.purchased_on}</td><td>{r.quantity} {r.unit}</td><td>{money(Number(r.total_cents))}</td><td>{money(Number(r.total_cents)/Number(r.quantity))}/{r.unit}</td></tr>)}</tbody></table></div></section>;}
function ImportCSV({data,onPost}:{data:Snapshot;onPost:(p:any,id?:string)=>Promise<void>}){const [rows,setRows]=useState<any[]>([]),[error,setError]=useState(''),[account,setAccount]=useState(''),[busy,setBusy]=useState(false);const fingerprints=new Set(posted(data).map(fingerprint));return <section className="panel"><h2>Importar extrato CSV</h2><p>Colunas: data (AAAA-MM-DD), descricao, valor (negativo = despesa), categoria (opcional). Revise antes de confirmar. Importação pessoal.</p><select aria-label="Conta do extrato" value={account} onChange={e=>setAccount(e.target.value)}><option value="">Selecione a conta</option>{active(data,'accounts').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><input type="file" accept=".csv,text/csv" onChange={async e=>{setError('');try{const file=e.target.files?.[0];if(!file)return;if(file.size>2e6)throw Error('Limite: 2 MB por CSV.');const result=parseCSV(await file.text()).map(r=>{const value=cents(r.valor??'');if(!/^\d{4}-\d{2}-\d{2}$/.test(r.data??'')||!r.descricao||value===0)throw Error('Revise data, descrição e valor do CSV.');return {kind:value<0?'expense':'income',scope:'personal',description:r.descricao,amount_cents:Math.abs(value),occurred_on:r.data,category:r.categoria||'Outros'};});const seen=new Set(fingerprints);setRows(result.map(r=>{const duplicate=seen.has(fingerprint(r));seen.add(fingerprint(r));return {...r,duplicate,selected:!duplicate,operationId:crypto.randomUUID()};}));}catch(e){setError(message(e));}}}/>
 {rows.map((r,i)=><label className="check" key={i}><input type="checkbox" checked={r.selected} onChange={e=>setRows(old=>old.map((x,j)=>i===j?{...x,selected:e.target.checked}:x))}/>{r.occurred_on} · {r.description} · {money(r.amount_cents)} {r.duplicate?'(possível duplicata)':''}</label>)}
 {error&&<p role="alert">{error}</p>}{rows.length>0&&<button disabled={!account||busy} onClick={async()=>{setBusy(true);setError('');try{for(let i=0;i<rows.length;i++){const r=rows[i];if(!r.selected)continue;const {selected,duplicate,operationId,...payload}=r;await onPost({...payload,account_id:account},operationId);setRows(old=>old.map((x,j)=>i===j?{...x,selected:false}:x));}setRows([]);}catch(e){setError(message(e));}finally{setBusy(false);}}}>{busy?'Importando…':'Confirmar selecionados'}</button>}</section>;}
function Documents({data,api,access,save,refresh,onTransaction,onItem}:{data:Snapshot;api:FinanceAPI;access:Ready;save:(t:string,d:any,r?:Row)=>Promise<void>;refresh:()=>Promise<void>;onTransaction:(p:any)=>void;onItem:(r:Row)=>void}){
 const [file,setFile]=useState<File>(),scope='family',[busy,setBusy]=useState(false),[error,setError]=useState(''),[text,setText]=useState(''),[progress,setProgress]=useState(''),[qr,setQr]=useState(''),[suggestion,setSuggestion]=useState<any>(),[selectedDocId,setSelectedDocId]=useState(''),[restored,setRestored]=useState(false);
 useEffect(()=>{
  let mounted=true,timeout:ReturnType<typeof setTimeout>|undefined;
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
  setFile(next);setSelectedDocId('');setText('');setQr('');setSuggestion(undefined);setRestored(false);
  try{await localDB.uploadDrafts.put({id:uploadDraftId(access.userId),userId:access.userId,file:next,filename:next.name,mimeType:next.type,scope,createdAt:Date.now()});}catch{setError('A foto foi selecionada, mas não foi possível guardá-la neste aparelho. Envie-a sem fechar a página.');}
 }
 async function run(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();}catch(e){setError(message(e));}finally{setBusy(false);setProgress('');}}
 async function upload(){if(!file)return;if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10485760)throw Error('Envie JPEG, PNG, WebP ou PDF de até 10 MB.');
 const hash=await checksum(file);let doc=data.documents.find(d=>d.checksum===hash&&d.owner_user_id===access.userId&&!d.archived);
 if(doc?.upload_status==='ready')throw Error('Este documento já está salvo. Abra-o na lista.');
 if(!doc){doc={id:crypto.randomUUID(),household_id:access.householdId,owner_user_id:access.userId,scope,filename:file.name,mime_type:file.type,size_bytes:file.size,checksum:hash,version:1};await api.save('documents',doc);}
 try{await api.upload(doc.id,file);}catch(e){try{const existing=await api.download(doc.id);const recovered=new File([existing],file.name,{type:file.type});if(await checksum(recovered)!==hash)throw e;}catch{throw e;}}
 await api.save('documents',{id:doc.id,upload_status:'ready'},doc.version);await localDB.uploadDrafts.delete(uploadDraftId(access.userId));setSelectedDocId(doc.id);await refresh();setFile(undefined);setRestored(false);
 }
 return <><section className="panel"><h2>Enviar nota ou documento</h2><input aria-label="Imagem ou PDF da nota" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={e=>void selectFile(e.target.files?.[0])}/>{file&&<p className="small">Arquivo selecionado: {file.name}{restored?' · recuperado deste aparelho':''}</p>}<p className="small">O documento ficará visível para os dois membros da família.</p><div className="toolbar"><button type="button" disabled={!file||busy} onClick={()=>void run(upload)}>Guardar documento</button><button type="button" className="secondary" disabled={!file||busy} onClick={()=>void run(async()=>{if(!file)return;const s=await recognize(file,setProgress);setText(s.text);setSuggestion(s);})}>Ler texto / OCR</button><button type="button" className="secondary" disabled={!file||file.type==='application/pdf'||busy} onClick={()=>void run(async()=>{if(!file)return;setProgress('Lendo QR Code…');setQr(await readQR(file));})}>Ler QR Code</button></div><p className="small">A foto selecionada fica temporariamente neste aparelho até ser guardada ou você sair da conta.</p>{progress&&<p role="status">{progress}</p>}{error&&<p role="alert" className="error">{error}</p>}{text&&<><details><summary>Texto reconhecido (diagnóstico)</summary><textarea rows={10} value={text} onChange={e=>setText(e.target.value)}/></details>{suggestion?.productsConsistent?<p role="status">Itens e total conferem automaticamente. Você poderá confirmar toda a compra de uma vez.</p>:<p role="alert" className="error">Os itens lidos não conferem com o total da nota. Eles não serão salvos automaticamente.</p>}<button type="button" onClick={()=>{let amount;try{amount=cents(suggestion?.total??'');}catch{amount=undefined;}onTransaction({description:'Compra '+(suggestion?.merchant??''),merchant:suggestion?.merchant,occurred_on:suggestion?.date||today(),amount_cents:amount,scope,kind:'expense'});}}>Revisar total como despesa</button></>}{qr&&<><p>QR identificado.</p>{/^https:\/\//.test(qr)&&<a href={qr} target="_blank" rel="noreferrer noopener">Abrir consulta oficial da nota</a>}<p className="small">A consulta fiscal depende do site emissor. O aplicativo não consulta a SEFAZ automaticamente.</p></>}</section>
 {text&&suggestion?.productsConsistent&&<ReceiptReview products={suggestion.products} expectedTotalCents={cents(suggestion.total)} document={active(data,'documents').find(d=>d.id===selectedDocId&&d.owner_user_id===access.userId)} merchant={suggestion?.merchant??''} date={suggestion?.date??today()} data={data} save={save}/>} 
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

