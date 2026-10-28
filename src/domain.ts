export type Row = {id:string; [key:string]:any};
export type Snapshot = Record<string,Row[]>;
export const TABLES=['accounts','cards','transactions','ledger_entries','card_installments','invoice_payments','categories','budgets','goals','goal_contributions','assets','shopping_items','recurring_rules','due_items','documents','receipt_items','audit_events'] as const;
export const emptySnapshot=():Snapshot=>Object.fromEntries(TABLES.map(t=>[t,[]]));
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
export function cents(input:string):number{
 const raw=input.trim().replace(/R\$\s*/,'');
 const normalized=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw;
 if(!/^-?\d+(\.\d{1,2})?$/.test(normalized)) throw Error('Use um valor com até dois centavos decimais.');
 const negative=normalized.startsWith('-'),[whole,fraction='']=normalized.replace('-','').split('.');
 const n=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(n)||n>1e12)throw Error('Valor fora do limite.');
 return negative?-n:n;
}
export function splits(amount:number,count:number){if(!Number.isSafeInteger(amount)||amount<=0||!Number.isInteger(count)||count<1||count>120||count>amount)throw Error('Parcelamento inválido');return Array.from({length:count},(_,i)=>Math.floor(amount/count)+(i<amount%count?1:0));}
export const active=(s:Snapshot,t:string)=>(s[t]??[]).filter(r=>!r.archived);
export const posted=(s:Snapshot)=>s.transactions.filter(t=>t.status==='posted');
export function balance(s:Snapshot,account:Row){const ids=new Set(posted(s).map(t=>t.id));return Number(account.opening_cents)+s.ledger_entries.filter(l=>l.account_id===account.id&&ids.has(l.transaction_id)).reduce((n,l)=>n+Number(l.amount_cents),0);}
export function invoices(s:Snapshot){const ids=new Set(posted(s).map(t=>t.id));const map=new Map<string,any>();for(const i of s.card_installments.filter(i=>ids.has(i.transaction_id))){const key=i.card_id+'|'+i.due_on;const item=map.get(key)??{id:key,card_id:i.card_id,due_on:i.due_on,total:0,paid:0};item.total+=Number(i.amount_cents);map.set(key,item);}for(const p of s.invoice_payments.filter(p=>ids.has(p.transaction_id))){const key=p.card_id+'|'+p.due_on;if(map.has(key))map.get(key).paid+=Number(p.amount_cents);}return [...map.values()].sort((a,b)=>a.due_on.localeCompare(b.due_on));}
export function summary(rows:Row[]){return rows.filter(r=>r.status==='posted').reduce((a,r)=>{if(r.kind==='income')a.income+=Number(r.amount_cents);if(r.kind==='expense')a.expense+=Number(r.amount_cents);return a;},{income:0,expense:0});}
export function monthDay(month:string,day:number){const [y,m]=month.slice(0,7).split('-').map(Number);const d=Math.min(day,new Date(Date.UTC(y,m,0)).getUTCDate());return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
export function normalizeUnit(quantity:number,unit:string){if(!Number.isFinite(quantity)||quantity<=0)throw Error('Quantidade inválida');if(unit==='g')return {quantity:quantity/1000,unit:'kg'};if(unit==='ml')return {quantity:quantity/1000,unit:'l'};if(!['un','kg','l'].includes(unit))throw Error('Unidade não comparável');return {quantity,unit};}
export const productKey=(s:string)=>s.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
export function fingerprint(r:any){return [r.occurred_on,r.kind,r.amount_cents,productKey(r.description??'')].join('|');}

