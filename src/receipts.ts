import {cents,productKey} from './domain';
export type ReceiptProduct={name:string;quantity:number;unit:'un'|'kg'|'l';total_cents:number};
// Apenas linhas com nome, quantidade, unidade e preço total explícitos viram sugestões.
export function parseReceiptProducts(text:string):ReceiptProduct[]{
 const products:ReceiptProduct[]=[];
 for(const raw of text.split(/\r?\n/)){
  const line=raw.trim().replace(/\s+/g,' ');
  const match=line.match(/^(?:\d{1,3}\s+)?(.{3,80}?)\s+(?:QTD?\s*[:.]?\s*)?(\d+(?:[.,]\d{1,3})?)\s*(UN|UND|UNID|KG|G|L|LT|ML)\s+(?:(?:X|x|@)\s*\d+[.,]\d{2}\s+)?(?:R\$\s*)?(\d+(?:\.\d{3})*,\d{2}|\d+\.\d{2})$/i);
  if(!match||/\b(total|troco|desconto|imposto|tributo|pagamento)\b/i.test(match[1]))continue;
  const quantity=Number(match[2].replace(',','.'));
  const unit=match[3].toLowerCase();
  const normalized=unit==='g'||unit==='ml'?quantity/1000:quantity;
  const normalizedUnit:ReceiptProduct['unit']=unit==='kg'||unit==='g'?'kg':unit==='l'||unit==='lt'||unit==='ml'?'l':'un';
  try{const total_cents=cents(match[4]);if(normalized>0&&total_cents>0)products.push({name:match[1].trim(),quantity:normalized,unit:normalizedUnit,total_cents});}catch{/* Linha incerta: revisão manual. */}
 }
 return products;
}
export async function recognize(file:File,progress:(text:string)=>void){
 let text='';
 if(file.type==='application/pdf'){
  const pdfjs=await import('pdfjs-dist');const workerUrl=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
  const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  if(doc.numPages>20)throw Error('Use um PDF de até 20 páginas.');
  try{for(let i=1;i<=doc.numPages;i++){progress('Lendo página '+i);const page=await doc.getPage(i);const content=await page.getTextContent();text+=content.items.map((item:any)=>item.str??'').join(' ')+'\n';}
  if(!text.trim())throw Error('Este PDF contém apenas imagens. Envie a foto da nota para usar OCR.');}finally{doc.cleanup();}
 }else{
 const {createWorker}=await import('tesseract.js');
 const base=import.meta.env.BASE_URL;
 const worker=await createWorker('por',1,{workerPath:`${base}tesseract/worker.min.js`,corePath:`${base}tesseract/tesseract-core-lstm.wasm.js`,langPath:`${base}tesseract`,logger:m=>progress(m.status==='recognizing text'?'Lendo nota: '+Math.round(m.progress*100)+'%':'Preparando leitura…')});
  try{const result=await worker.recognize(file);text=result.data.text;}finally{await worker.terminate();}
 }
 const total=[...text.matchAll(/(?:valor\s+(?:total|a\s+pagar)|total\s+r?\$?)\s*[:\s]*([\d.,]+)/gi)].at(-1)?.[1]??'';
 const date=text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
 return {text,total,date:date?`${date[3]}-${date[2]}-${date[1]}`:'',merchant:text.split('\n').find(l=>l.trim().length>3)?.trim()??''};
}
export async function readQR(file:File){
 const {BrowserQRCodeReader}=await import('@zxing/browser');const reader=new BrowserQRCodeReader();const url=URL.createObjectURL(file);
 try{return (await reader.decodeFromImageUrl(url)).getText();}finally{URL.revokeObjectURL(url);}
}
export async function checksum(file:File){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export {productKey};

