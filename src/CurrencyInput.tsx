import {useEffect,useState,type InputHTMLAttributes} from 'react';

function digitsToCurrency(value:string){
 const digits=value.replace(/\D/g,'');
 if(!digits)return '';
 const cents=Number(digits);
 if(!Number.isSafeInteger(cents)||cents>1e12)return 'R$ 10.000.000.000,00';
 return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
}

/** Campo monetário: 1 vira R$ 0,01 e 1000 vira R$ 10,00. */
export function CurrencyInput({defaultValue='',onAmountChange,...props}:{defaultValue?:string;onAmountChange?:(cents:number|undefined)=>void}&Omit<InputHTMLAttributes<HTMLInputElement>,'defaultValue'|'type'|'inputMode'|'onChange'>){
 const [value,setValue]=useState(()=>digitsToCurrency(defaultValue));
 useEffect(()=>{setValue(digitsToCurrency(defaultValue));},[defaultValue]);
 function change(next:string){
  const formatted=digitsToCurrency(next);
  setValue(formatted);
  const digits=next.replace(/\D/g,'');
  onAmountChange?.(digits?Number(digits):undefined);
 }
 return <input {...props} type="text" inputMode="numeric" autoComplete="off" value={value} placeholder="R$ 0,00" onChange={e=>change(e.target.value)}/>;
}
