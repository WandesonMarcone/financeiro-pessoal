import {describe,expect,it} from 'vitest';
import {parseReceiptProducts,productsMatchReceiptTotal} from '../src/receipts';

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
 it('só confirma automaticamente itens cuja soma bate com o total',()=>{
  const products=parseReceiptProducts('67249 BATATA INGLESA 2,305 KG X 3,98 9,17\n1397 LIMAO 0,320 KG X 11,98 3,83\nREFRIGERANTE 1 EU X 1,28 1,28\nMANGA PALMER 1,290 KG X 3,98 5,13\nDETERGENTE 1 PT X 10,80 10,80');
  expect(productsMatchReceiptTotal(products,'31,49')).toEqual({expected:3149,actual:3021,consistent:false});
  expect(productsMatchReceiptTotal(products,'30,21')).toEqual({expected:3021,actual:3021,consistent:true});
 });
});
