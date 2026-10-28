import type {ReactNode} from 'react';
import type {Row, Snapshot} from './domain';
import {active} from './domain';

export const DEFAULT_CATEGORIES = [
 'Alimentação',
 'Moradia',
 'Água e energia',
 'Transporte',
 'Saúde',
 'Educação',
 'Lazer',
 'Assinaturas',
 'Salário',
 'Outros'
] as const;

type SetupGuideProps={
 snapshot:Snapshot;
 onSeedCategories:()=>Promise<void>;
 onOpen:(table:string)=>void;
 busy?:boolean;
};

export function SetupGuide({snapshot,onSeedCategories,onOpen,busy=false}:SetupGuideProps){
 const categories=active(snapshot,'categories');
 const accounts=active(snapshot,'accounts');
 const cards=active(snapshot,'cards');
 const transactions=active(snapshot,'transactions');
 const steps=[
  {label:'Categorias padrão',done:categories.length>0,action:categories.length?()=>onOpen('categories'):onSeedCategories},
  {label:'Primeira conta',done:accounts.length>0,action:()=>onOpen('accounts')},
  {label:'Cartão de crédito',done:cards.length>0,action:()=>onOpen('cards')},
  {label:'Primeiro lançamento',done:transactions.length>0,action:()=>onOpen('transactions')}
 ];
 const complete=steps.filter(step=>step.done).length;
 if(complete===steps.length)return null;
 return <section className="panel setup-guide" aria-labelledby="setup-title">
  <p className="eyebrow">PRIMEIROS PASSOS</p>
  <h2 id="setup-title">Vamos preparar seu controle financeiro</h2>
  <p className="small">Os valores são preenchidos somente por vocês. O sistema não inventa saldo, conta ou cartão.</p>
  <div className="setup-progress" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={complete}>
   <strong>{complete} de {steps.length} etapas concluídas</strong><span>{Math.round(complete/steps.length*100)}%</span>
  </div>
  <div className="setup-list">{steps.map(step=><div className="setup-step" key={step.label}>
   <span className={step.done?'setup-check done':'setup-check'} aria-hidden="true">{step.done?'✓':'○'}</span>
   <span>{step.label}</span>
   <button className="quiet" onClick={()=>void step.action()} disabled={busy}>{step.done?'Editar':'Configurar'}</button>
  </div>)}</div>
 </section>;
}

export function seededCategoryRows(snapshot:Snapshot,householdId:string,userId:string):Row[]{
 const existing=new Set(active(snapshot,'categories').map(row=>String(row.name).trim().toLocaleLowerCase('pt-BR')));
 return DEFAULT_CATEGORIES.filter(name=>!existing.has(name.toLocaleLowerCase('pt-BR'))).map(name=>({
  id:crypto.randomUUID(),household_id:householdId,owner_user_id:userId,scope:'family',name,parent_name:'',version:1
 }));
}

export function SetupHint({children}:{children:ReactNode}){return <p className="setup-hint">{children}</p>;}
