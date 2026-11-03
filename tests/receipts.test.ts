import {describe,expect,it} from 'vitest';
import {mergeReceiptProducts,parseReceiptProducts,productsMatchReceiptTotal,receiptReconciliation} from '../src/receipts';

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
 it('tolera um kg imperfeito, mas recusa quantidade incompatível com preço e total',()=>{
  expect(parseReceiptProducts('BATATA 2,305 KA X 3,98 9,17\nREFRIGERANTE 106 EU X 1,28 1,28')).toEqual([
   {name:'BATATA',quantity:2.305,unit:'kg',unit_cents:398,total_cents:917}
  ]);
 });
 it('lê cupons com descrição e preço em linhas diferentes e não duplica a sobreposição',()=>{
  const page=parseReceiptProducts('001 7890000000000 OVO BRANCO EXTRA 20UN\n1,000 Un x 11,90 11,90\n002 COXA SOBRECOXA 1KG\n1,000 PC x 12,49 12,49');
  expect(page).toEqual([
   {name:'OVO BRANCO EXTRA 20UN',quantity:1,unit:'un',unit_cents:1190,total_cents:1190,sourceKey:'item:001'},
   {name:'COXA SOBRECOXA 1KG',quantity:1,unit:'un',unit_cents:1249,total_cents:1249,sourceKey:'item:002'}
  ]);
  expect(mergeReceiptProducts([page,page])).toHaveLength(2);
 });
 it('aceita subtotal menos desconto como total pago',()=>{
  const products=parseReceiptProducts('001 ARROZ\n1 UN x 10,00 10,00\n002 FEIJAO\n1 UN x 5,00 5,00');
  expect(receiptReconciliation(products,'13,00','15,00','2,00')).toEqual({actual:1500,expected:1300,consistent:true});
 });
 it('recupera itens de cupom Leal com centavo final cortado pelo OCR',()=>{
  const products=parseReceiptProducts('001 7898241710153 Ovos Decs Branco Gra 1 Un 9,99 9,5;\n002 0000000034258 Pao Frances Leal Kg 0,280 Kg 16,89 4,72\n003 0000000002172 Manga Kg 1,285 Kg 4,69 6,02');
  expect(products).toEqual([
   {name:'Ovos Decs Branco Gra',quantity:1,unit:'un',unit_cents:999,total_cents:999,sourceKey:'item:001'},
   {name:'Pao Frances Leal Kg',quantity:.28,unit:'kg',unit_cents:1689,total_cents:472,sourceKey:'item:002'},
   {name:'Manga Kg',quantity:1.285,unit:'kg',unit_cents:469,total_cents:602,sourceKey:'item:003'}
  ]);
  expect(receiptReconciliation(products,'20,73')).toEqual({actual:2073,expected:2073,consistent:true});
 });
});
