import {describe,expect,it} from 'vitest';
import {parseReceiptProducts} from '../src/receipts';

describe('sugestões da nota fiscal',()=>{
 it('extrai linhas explícitas e normaliza unidades pequenas',()=>{
  expect(parseReceiptProducts('ARROZ BRANCO 2 UN 17,90\nCAFE 500 G 12,45\nLEITE 500 ML 3,99')).toEqual([
   {name:'ARROZ BRANCO',quantity:2,unit:'un',total_cents:1790},
   {name:'CAFE',quantity:.5,unit:'kg',total_cents:1245},
   {name:'LEITE',quantity:.5,unit:'l',total_cents:399}
  ]);
 });
 it('ignora totais e linhas incertas para revisão humana',()=>{
  expect(parseReceiptProducts('TOTAL 1 UN 99,90\nDESCONTO 2 UN 2,00\nARROZ 19,90')).toEqual([]);
 });
});
