import {describe,expect,it} from 'vitest';
import {balance,cents,emptySnapshot,fingerprint,invoices,monthDay,normalizeUnit,productKey,splits,summary} from '../src/domain';

describe('regras monetárias',()=>{
 it('converte reais em centavos sem ponto flutuante',()=>{
  expect(cents('1.234,56')).toBe(123456);
  expect(cents('1234.5')).toBe(123450);
  expect(()=>cents('12,345')).toThrow();
 });
 it('divide parcelas conservando o total',()=>{
  expect(splits(10001,3)).toEqual([3334,3334,3333]);
  expect(()=>splits(1,2)).toThrow();
 });
 it('limita o dia ao último dia do mês',()=>{
  expect(monthDay('2026-02',31)).toBe('2026-02-28');
  expect(monthDay('2028-02',31)).toBe('2028-02-29');
 });
});

describe('razão e cartões',()=>{
 it('calcula saldo somente com lançamentos válidos e não duplica fatura',()=>{
  const s=emptySnapshot();
  s.accounts=[{id:'a',opening_cents:1000}];
  s.transactions=[
   {id:'income',status:'posted',kind:'income',amount_cents:5000},
   {id:'expense',status:'posted',kind:'expense',amount_cents:2000},
   {id:'void',status:'void',kind:'expense',amount_cents:9999},
   {id:'payment',status:'posted',kind:'card_payment',amount_cents:1000}
  ];
  s.ledger_entries=[
   {id:'1',transaction_id:'income',account_id:'a',amount_cents:5000},
   {id:'2',transaction_id:'expense',account_id:'a',amount_cents:-2000},
   {id:'3',transaction_id:'void',account_id:'a',amount_cents:-9999},
   {id:'4',transaction_id:'payment',account_id:'a',amount_cents:-1000}
  ];
  s.card_installments=[{id:'i',transaction_id:'expense',card_id:'c',due_on:'2026-11-05',amount_cents:2000}];
  s.invoice_payments=[{id:'p',transaction_id:'payment',card_id:'c',due_on:'2026-11-05',amount_cents:1000}];
  expect(balance(s,s.accounts[0])).toBe(3000);
  expect(invoices(s)[0]).toMatchObject({total:2000,paid:1000});
  expect(summary(s.transactions)).toEqual({income:5000,expense:2000});
 });
});

describe('normalização e duplicidade',()=>{
 it('normaliza unidades e nomes de produto',()=>{
  expect(normalizeUnit(500,'g')).toEqual({quantity:.5,unit:'kg'});
  expect(productKey('  Café   ÁRABICA ')).toBe('cafe arabica');
  expect(fingerprint({occurred_on:'2026-10-01',kind:'expense',amount_cents:100,description:' Café '}))
   .toBe('2026-10-01|expense|100|cafe');
 });
});
