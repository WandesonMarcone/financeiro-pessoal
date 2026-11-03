import {cents,productKey} from './domain';
export const receiptCategories=['Alimentação','Bebidas','Higiene pessoal','Limpeza','Combustível','Lanche','Saúde','Outros'] as const;
export type ReceiptProduct={name:string;quantity:number;unit:'un'|'kg'|'l';total_cents:number;unit_cents?:number;category?:string;sourceKey?:string};
export type ReceiptAnalysis={text:string;total:string;subtotal:string;discount:string;date:string;merchant:string;paymentMethod:string;confidence:number;products:ReceiptProduct[];productsTotalCents:number;productsConsistent:boolean};
const excluded=/\b(total|troco|desconto|imposto|tributo|pagamento|valor\s+pago|subtotal)\b/i;
const amount=(value:string)=>value.replace(/[^\d,.-]/g,'').replace(/([,.])-$/,'$1');
const decimals=(value:string)=>{const match=amount(value).match(/[,.](\d+)$/);return match?.[1].length??0;};
function receiptProduct(name:string,quantityText:string,unitText:string,unitTextPrice?:string,totalText?:string,sourceKey?:string):ReceiptProduct|undefined{
 const quantity=Number(quantityText.replace(',','.')),unit=unitText.toLowerCase(),normalized=unit==='g'||unit==='ml'?quantity/1000:quantity;
 const normalizedUnit:ReceiptProduct['unit']=unit.startsWith('k')||unit==='g'?'kg':unit==='l'||unit==='lt'||unit==='ml'?'l':'un';
 if(!(normalized>0)||!totalText)return;
 try{
  const unit_cents=unitTextPrice?cents(amount(unitTextPrice)):undefined;
  let total_cents=cents(amount(totalText));
  const calculated=unit_cents===undefined?undefined:Math.round(normalized*unit_cents);
  // A impressão fiscal sempre tem dois centavos. Se o OCR leu só um deles,
  // a conta quantidade × preço é mais confiável que inventar outro valor.
  if(calculated!==undefined&&Math.abs(calculated-total_cents)>2){if(decimals(totalText)<2)total_cents=calculated;else return;}
  return {name:name.trim(),quantity:normalized,unit:normalizedUnit,total_cents,...(unit_cents===undefined?{}:{unit_cents}),...(sourceKey?{sourceKey}:{})};
 }catch{return;}
}
// Apenas linhas com nome, quantidade, unidade e preço total explícitos viram sugestões.
export function parseReceiptProducts(text:string):ReceiptProduct[]{
 const products:ReceiptProduct[]=[];
 let pending:{name:string;sourceKey:string}|undefined;
 for(const raw of text.split(/\r?\n/)){
  const line=raw.trim().replace(/[|]/g,' ').replace(/\s+/g,' ').replace(/(?<=\d)[;:](?=\s|$)/g,'');
  // Alguns cupons (como o Assaí) imprimem a descrição em uma linha e a
  // quantidade/preços na seguinte. O número do item é a proteção contra
  // duplicar a área de sobreposição de duas fotos da mesma nota.
  const header=line.match(/^(\d{3})\s+(?:\d{8,14}\s+)?(.{3,80})$/);
  const hasRowValues=/\s+\d+(?:[.,]\d+)?\s*(?:UN|UND|UNID|K[A-Z]?|G|L|LT|ML|PC|PCT|PT|CX|FD|EV|EU)\s+(?:X\s*)?[\d.,]+\s+[\d.,;:]+$/i.test(line);
  if(header&&!excluded.test(header[2])&&!hasRowValues){pending={name:header[2].trim(),sourceKey:`item:${header[1]}`};continue;}
  const continuation=pending&&line.match(/^(\d+(?:[.,]\d{1,3})?)\s*(UN|UND|UNID|K[A-Z]?|G|L|LT|ML|PC|PCT|PT|CX|FD|EV|EU)\s+(?:X\s*)?([\d.,]+)\s+([\d.,;:]+)$/i);
  if(continuation&&pending){
   const product=receiptProduct(pending.name,continuation[1],continuation[2],continuation[3],continuation[4],pending.sourceKey);if(product)products.push(product);
   pending=undefined;continue;
  }
  // K? aceita um "kg" que o OCR tenha lido imperfeitamente como "ka", por exemplo.
  const match=line.match(/^(?:\d{3}\s+)?(?:\d{8,14}\s+)?(.{3,80}?)\s+(?:QTD?\s*[:.]?\s*)?(\d+(?:[.,]\d{1,3})?)\s*(UN|UND|UNID|K[A-Z]?|G|L|LT|ML|PC|PCT|PT|CX|FD|EV|EU)\s+(?:(?:X|x|@)?\s*([\d.,]+)\s+)?(?:R\$\s*)?([\d.,;:]+)$/i);
  if(!match||excluded.test(match[1]))continue;
  const sequence=line.match(/^(\d{3})\s/),product=receiptProduct(match[1],match[2],match[3],match[4],match[5],sequence?`item:${sequence[1]}`:undefined);if(product)products.push(product);
 }
 return products;
}
export function productsMatchReceiptTotal(products:ReceiptProduct[],total:string){
 try{const expected=cents(total),actual=products.reduce((sum,item)=>sum+item.total_cents,0);return {expected,actual,consistent:products.length>0&&Math.abs(expected-actual)<=1};}
 catch{return {expected:0,actual:products.reduce((sum,item)=>sum+item.total_cents,0),consistent:false};}
}
export function mergeReceiptProducts(pages:ReceiptProduct[][]):ReceiptProduct[]{
 const result:ReceiptProduct[]=[];const seen=new Set<string>();
 for(const product of pages.flat()){
  // Só há deduplicação automática com o número explícito da linha fiscal.
  // Dois itens de mesmo nome/código podem ser compras legítimas distintas.
  const signature=product.sourceKey?[product.sourceKey,productKey(product.name),product.quantity,product.total_cents].join('|'):'';
  if(signature&&seen.has(signature))continue;
  if(signature)seen.add(signature);result.push(product);
 }
 return result;
}
export function receiptReconciliation(products:ReceiptProduct[],total:string,subtotal='',discount=''){
 const actual=products.reduce((sum,item)=>sum+item.total_cents,0);
 try{const expected=cents(total),sub=subtotal?cents(subtotal):undefined,off=discount?cents(discount):0;
  const consistent=products.length>0&&(Math.abs(actual-expected)<=1||(sub!==undefined&&Math.abs(actual-sub)<=1&&Math.abs(sub-off-expected)<=1));
  return {actual,expected,consistent};
 }catch{return {actual,expected:0,consistent:false};}
}
export function analysisFromAI(raw:any):ReceiptAnalysis{
 const list=Array.isArray(raw?.products)?raw.products:[];
 const products=list.flatMap((item:any,index:number)=>{
  const name=typeof item?.name==='string'?item.name.trim():'',quantity=Number(item?.quantity),unit=String(item?.unit??'').toLowerCase();
  if(!name||!Number.isFinite(quantity)||quantity<=0||!['un','kg','l'].includes(unit))return [];
  try{const total_cents=cents(String(item.total??'')),unit_cents=item.unitPrice?cents(String(item.unitPrice)):undefined,category=receiptCategories.includes(item.category)?item.category:'Outros';if(total_cents<=0)return [];return [{name,quantity,unit:unit as ReceiptProduct['unit'],total_cents,...(unit_cents?{unit_cents}:{category}),sourceKey:`ai:${index}`}];}catch{return [];}
 });
 const total=amount(String(raw?.total??'')),subtotal=amount(String(raw?.subtotal??'')),discount=amount(String(raw?.discount??'')),check=receiptReconciliation(products,total,subtotal,discount);
 return {text:'Análise feita por IA. Revise os itens antes de confirmar.',total,subtotal,discount,date:/^\d{4}-\d{2}-\d{2}$/.test(String(raw?.date??''))?raw.date:'',merchant:typeof raw?.merchant==='string'?raw.merchant.trim():'',paymentMethod:typeof raw?.paymentMethod==='string'?raw.paymentMethod.trim():'',confidence:100,products,productsTotalCents:check.actual,productsConsistent:check.consistent};
}
function merchantFrom(text:string){
 const found=text.split(/\r?\n/).find(line=>/supermercad|assa[ií]|sendas|atacad|mercado/i.test(line));
 if(!found)return text.split(/\r?\n/).find(line=>line.trim().length>3)?.trim()??'';
 if(/supermercados?\s+leal/i.test(found))return 'Supermercados Leal';
 if(/supermercados?\s+bh/i.test(found))return 'Supermercado BH';
 if(/sendas|assa[ií]/i.test(found))return 'Assaí';
 return found.trim();
}
function analyzeText(text:string,confidence:number){
 const total=[...text.matchAll(/(?:valor\s+(?:total|a\s+pagar)|total\s+r?\$?)\s*[:\s]*([\d.,;:]+)/gi)].at(-1)?.[1]??'';
 const subtotal=[...text.matchAll(/(?:sub\s*total)\s*(?:r\$)?\s*[:\s]*([\d.,;:]+)/gi)].at(-1)?.[1]??'';
 const discount=[...text.matchAll(/(?:desconto)\s*(?:r\$)?\s*[:\s-]*([\d.,;:]+)/gi)].at(-1)?.[1]??'';
 const date=text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/),payment=text.match(/(?:forma\s+de\s+pagamento\s*\n?\s*|pagamento\s*[:\-]?\s*)([^\n]{3,60})/i);
 const products=parseReceiptProducts(text),check=receiptReconciliation(products,amount(total),amount(subtotal),amount(discount));
 return {text,total:amount(total),subtotal:amount(subtotal),discount:amount(discount),date:date?`${date[3]}-${date[2]}-${date[1]}`:'',merchant:merchantFrom(text),paymentMethod:payment?.[1].trim().replace(/\s+/g,' ')??'',confidence,products,productsTotalCents:check.actual,productsConsistent:check.consistent} satisfies ReceiptAnalysis;
}
function analysisScore(result:ReceiptAnalysis){return (result.productsConsistent?10000:0)+result.products.length*100+Math.min(99,result.confidence);}
export async function recognize(file:File,progress:(text:string)=>void){
 let text='',confidence=100;
 if(file.type==='application/pdf'){
  const pdfjs=await import('pdfjs-dist');const workerUrl=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
  const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  if(doc.numPages>20)throw Error('Use um PDF de até 20 páginas.');
  try{for(let i=1;i<=doc.numPages;i++){progress('Lendo página '+i);const page=await doc.getPage(i);const content=await page.getTextContent();text+=content.items.map((item:any)=>item.str??'').join(' ')+'\n';}
  if(!text.trim())throw Error('Este PDF contém apenas imagens. Envie a foto da nota para usar OCR.');}finally{doc.cleanup();}
 }else{
 const {createWorker,PSM}=await import('tesseract.js');
 const base=import.meta.env.BASE_URL;
 const worker=await createWorker('por',1,{workerPath:`${base}tesseract/worker.min.js`,corePath:`${base}tesseract/tesseract-core-lstm.wasm.js`,langPath:`${base}tesseract`,logger:m=>progress(m.status==='recognizing text'?'Lendo nota: '+Math.round(m.progress*100)+'%':'Preparando leitura…')});
  try{await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK,preserve_interword_spaces:'1'});const variants=await receiptImageVariants(file);const results:ReceiptAnalysis[]=[];
   for(let index=0;index<variants.length;index++){progress(`Lendo nota: tentativa ${index+1} de ${variants.length}`);const result=await worker.recognize(variants[index]);results.push(analyzeText(result.data.text,result.data.confidence));}
   const best=results.sort((a,b)=>analysisScore(b)-analysisScore(a))[0];text=best.text;confidence=best.confidence;
  }finally{await worker.terminate();}
 }
 return analyzeText(text,confidence);
}
export async function readQR(file:File){
 const {BrowserQRCodeReader}=await import('@zxing/browser');const reader=new BrowserQRCodeReader(),candidates=await qrCandidateUrls(file);
 try{
  for(const candidate of candidates){try{return (await reader.decodeFromImageUrl(candidate)).getText();}catch{/* tenta a próxima versão */}}
  throw Error('Não foi possível identificar o QR Code nesta foto. Aproxime a câmera do QR Code ou envie uma foto focada apenas nele.');
 }finally{candidates.forEach(URL.revokeObjectURL);}
}
async function canvasFor(file:File,crop?:{x:number;y:number;width:number;height:number}){
 const image=await createImageBitmap(file),source=crop??{x:0,y:0,width:image.width,height:image.height};
 const scale=Math.min(2,Math.max(1,1800/source.width)),canvas=document.createElement('canvas');canvas.width=Math.round(source.width*scale);canvas.height=Math.round(source.height*scale);
 const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw Error('Não foi possível preparar esta imagem.');
 context.drawImage(image,source.x,source.y,source.width,source.height,0,0,canvas.width,canvas.height);image.close();return {canvas,context};
}
async function qrCandidateUrls(file:File){
 const urls=[URL.createObjectURL(file)];
 if(!file.type.startsWith('image/')||typeof createImageBitmap==='undefined')return urls;
 try{const image=await createImageBitmap(file);
  for(const angle of [0,90,180,270]){const swapped=angle===90||angle===270,width=swapped?image.height:image.width,height=swapped?image.width:image.height,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)continue;
   context.save();if(angle===90){context.translate(width,0);context.rotate(Math.PI/2);}if(angle===180){context.translate(width,height);context.rotate(Math.PI);}if(angle===270){context.translate(0,height);context.rotate(-Math.PI/2);}context.drawImage(image,0,0);context.restore();
   const full=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));if(full)urls.push(URL.createObjectURL(full));
   const side=Math.min(width,height),crop=document.createElement('canvas');crop.width=side;crop.height=side;crop.getContext('2d')?.drawImage(canvas,(width-side)/2,(height-side)/2,side,side,0,0,side,side);const centered=await new Promise<Blob|null>(resolve=>crop.toBlob(resolve,'image/png'));if(centered)urls.push(URL.createObjectURL(centered));
  }image.close();
 }catch{/* a foto original ainda será tentada */}
 return urls;
}
async function receiptImageVariants(file:File){
 if(!file.type.startsWith('image/')||typeof createImageBitmap==='undefined')return [file];
 const enhanced=await enhanceReceiptImage(file),threshold=await thresholdReceiptImage(file);return [enhanced,threshold].filter(Boolean) as Blob[];
}
async function enhanceReceiptImage(file:File){
 if(!file.type.startsWith('image/')||typeof createImageBitmap==='undefined')return file;
 try{const {canvas,context}=await canvasFor(file),pixels=context.getImageData(0,0,canvas.width,canvas.height);
  for(let i=0;i<pixels.data.length;i+=4){const gray=.299*pixels.data[i]+.587*pixels.data[i+1]+.114*pixels.data[i+2],value=Math.max(0,Math.min(255,(gray-130)*1.8+130));pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;}
  context.putImageData(pixels,0,0);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));return blob??file;
 }catch{return file;}
}
async function thresholdReceiptImage(file:File){
 try{const {canvas,context}=await canvasFor(file),pixels=context.getImageData(0,0,canvas.width,canvas.height);let sum=0;
  for(let i=0;i<pixels.data.length;i+=4)sum+=.299*pixels.data[i]+.587*pixels.data[i+1]+.114*pixels.data[i+2];
  const threshold=Math.max(130,Math.min(220,sum/(pixels.data.length/4)-20));
  for(let i=0;i<pixels.data.length;i+=4){const gray=.299*pixels.data[i]+.587*pixels.data[i+1]+.114*pixels.data[i+2],value=gray>threshold?255:0;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;}
  context.putImageData(pixels,0,0);return await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));
 }catch{return null;}
}
export async function checksum(file:File){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export {productKey};

