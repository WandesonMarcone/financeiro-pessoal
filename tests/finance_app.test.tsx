import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe,expect,it,vi} from 'vitest';
import {FinanceApp} from '../src/FinanceApp';
import {emptySnapshot} from '../src/domain';
import type {FinanceAPI} from '../src/finance';

function api():FinanceAPI{return {
 load:vi.fn().mockResolvedValue(emptySnapshot()),
 post:vi.fn().mockResolvedValue(undefined),
 save:vi.fn().mockResolvedValue(undefined),
 upload:vi.fn().mockResolvedValue(undefined),
 download:vi.fn().mockResolvedValue(new Blob())
};}

describe('aplicativo financeiro',()=>{
 it('carrega os módulos reais e registra despesa pela fila idempotente',async()=>{
  Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
  const finance=api(),user=userEvent.setup();
  render(<FinanceApp api={finance} access={{kind:'ready',userId:'user-a',householdId:'house-a',householdName:'Família teste',displayName:'Pessoa A'}} profile={<p>Perfil</p>}/>);
  expect(await screen.findByText('Saldo das minhas contas')).toBeInTheDocument();
  await user.click(screen.getByRole('checkbox',{name:'Modo simples'}));
  expect(screen.getByRole('button',{name:'Contas'})).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'+ Registrar gasto'}));
  await user.type(screen.getByLabelText('Descrição'),'Mercado');
  await user.type(screen.getByLabelText('Valor (R$)'),'12,34');
  await user.click(screen.getByRole('button',{name:'Registrar'}));
  await waitFor(()=>expect(finance.post).toHaveBeenCalledTimes(1));
  expect(finance.post).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({
   household_id:'house-a',kind:'expense',scope:'family',description:'Mercado',amount_cents:1234
  }));
 });
});
