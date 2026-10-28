import {useState,type FormEvent} from 'react';
import {cents,type Row} from './domain';
export type Field={key:string;label:string;type?:'text'|'money'|'date'|'number'|'select'|'textarea';options?:{value:string;label:string}[];optional?:boolean;default?:string};
export function ResourceEditor({title,fields,initial,allowScope=true,onSave,onClose}:{title:string;fields:Field[];initial?:Row;allowScope?:boolean;onSave:(data:any)=>Promise<void>;onClose:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');try{
  const form=new FormData(e.currentTarget),data:any={};
  for(const f of fields){const value=String(form.get(f.key)??'').trim();if(!value&&f.optional){data[f.key]=f.type==='date'?null:'';continue;}if(f.type==='money')data[f.key]=cents(value);else if(f.type==='number')data[f.key]=Number(value);else data[f.key]=value;}
  if(allowScope)data.scope=form.get('scope');await onSave(data);onClose();
 }catch(e){setError(e instanceof Error?e.message:'Falha ao salvar');}finally{setBusy(false);}}
 return <section className="editor" aria-label={title}><div className="row spread"><h2>{title}</h2><button type="button" className="quiet" onClick={onClose}>Fechar</button></div><form onSubmit={submit} className="grid-form">{fields.map(f=>{const value=initial?.[f.key];const def=value==null?(f.default??''):f.type==='money'?(Number(value)/100).toFixed(2).replace('.',','):String(value);return <label key={f.key}>{f.label}{f.type==='select'?<select name={f.key} defaultValue={def} required={!f.optional}><option value="">Selecione</option>{f.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:f.type==='textarea'?<textarea name={f.key} defaultValue={def}/>:<input name={f.key} type={f.type==='date'?'date':f.type==='number'?'number':'text'} inputMode={f.type==='money'?'decimal':undefined} step={f.type==='number'?'any':undefined} defaultValue={def} required={!f.optional} maxLength={f.type==='text'||!f.type?250:undefined}/>}</label>;})}
 {allowScope&&<label>Visibilidade<select name="scope" defaultValue={initial?.scope??'personal'}><option value="personal">Só eu</option><option value="family">Família</option></select></label>}
 {error&&<p className="error" role="alert">{error}</p>}<button disabled={busy}>{busy?'Salvando…':'Salvar'}</button></form></section>;
}

