import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe,expect,it,vi} from 'vitest';
import {FinanceApp,purchaseFilename} from '../src/FinanceApp';
import {emptySnapshot} from '../src/domain';
import type {FinanceAPI} from '../src/finance';

function api():FinanceAPI{return {
 load:vi.fn().mockResolvedValue(emptySnapshot()),
 post:vi.fn().mockResolvedValue(undefined),
 save:vi.fn().mockResolvedValue(undefined),
 upload:vi.fn().mockResolvedValue(undefined),
 download:vi.fn().mockResolvedValue(new Blob()),
 analyzeReceiptWithAI:vi.fn().mockResolvedValue({}),
 removeDocument:vi.fn().mockResolvedValue(undefined)
};}

describe('aplicativo financeiro',()=>{
 it('padroniza o arquivo salvo com compra, estabelecimento e data',()=>{
  const file=new File(['nota'],'WhatsApp Image 2026-11-03 at 23.00.00.jpeg',{type:'image/jpeg'});
  expect(purchaseFilename(file,'Supermercados Leal Ltda','2026-11-03')).toBe('compra-supermercados-leal-ltda-2026-11-03.jpeg');
 });
 it('carrega os módulos reais e registra despesa pela fila idempotente',async()=>{
  Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
  const finance=api(),user=userEvent.setup();
  render(<FinanceApp api={finance} access={{kind:'ready',userId:'user-a',householdId:'house-a',householdName:'Família teste',displayName:'Pessoa A'}} profile={<p>Perfil</p>}/>);
  expect(await screen.findByText('Saldo das minhas contas')).toBeInTheDocument();
  await user.click(screen.getByRole('checkbox',{name:'Modo simples'}));
  expect(screen.getByRole('button',{name:'Contas'})).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'+ Registrar gasto'}));
  await user.selectOptions(screen.getByRole('combobox',{name:''}),'Alimentação');
  await user.type(screen.getByLabelText('Descrição'),'Mercado');
  await user.type(screen.getByLabelText('Valor (R$)'),'1234');
  expect(screen.getByLabelText('Valor (R$)')).toHaveValue('R$ 12,34');
  await user.click(screen.getByRole('button',{name:'Salvar compra'}));
  await waitFor(()=>expect(finance.post).toHaveBeenCalledTimes(1));
  expect(finance.post).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({
   household_id:'house-a',kind:'expense',scope:'family',description:'Mercado',amount_cents:1234
  }));
 });
 it('mantém o cupom como rascunho e não oferece leitura de QR Code',async()=>{
  const finance=api(),user=userEvent.setup();
  render(<FinanceApp api={finance} access={{kind:'ready',userId:'user-a',householdId:'house-a',householdName:'Família teste',displayName:'Pessoa A'}} profile={<p>Perfil</p>}/>);
  await user.click(await screen.findByRole('button',{name:'Notas e documentos'}));
  expect(screen.getByText('Ler cupom de compra')).toBeInTheDocument();
  expect(screen.getByText(/somente neste aparelho até você revisar/i)).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/ler qr code/i})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/só guardar arquivo/i})).not.toBeInTheDocument();
 });
});
