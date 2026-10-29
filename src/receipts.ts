import {cents,productKey} from './domain';
export type ReceiptProduct={name:string;quantity:number;unit:'un'|'kg'|'l';total_cents:number};
export type ReceiptAnalysis={text:string;total:string;date:string;merchant:string;confidence:number;products:ReceiptProduct[];productsTotalCents:number;productsConsistent:boolean};
// Apenas linhas com nome, quantidade, unidade e preço total explícitos viram sugestões.
export function parseReceiptProducts(text:string):ReceiptProduct[]{
 const products:ReceiptProduct[]=[];
 for(const raw of text.split(/\r?\n/)){
  const line=raw.trim().replace(/[|]/g,' ').replace(/\s+/g,' ');
  // K? aceita um "kg" que o OCR tenha lido imperfeitamente como "ka", por exemplo.
  const match=line.match(/^(?:\d{3,14}\s+)?(.{3,80}?)\s+(?:QTD?\s*[:.]?\s*)?(\d+(?:[.,]\d{1,3})?)\s*(UN|UND|UNID|K[A-Z]?|G|L|LT|ML|PC|PCT|PT|CX|FD|EV|EU)\s+(?:(?:X|x|@)\s*(\d+[.,]\d{2})\s+)?(?:R\$\s*)?(\d+(?:\.\d{3})*,\d{2}|\d+\.\d{2})$/i);
  if(!match||/\b(total|troco|desconto|imposto|tributo|pagamento)\b/i.test(match[1]))continue;
  const quantity=Number(match[2].replace(',','.'));
  const unit=match[3].toLowerCase();
  const normalized=unit==='g'||unit==='ml'?quantity/1000:quantity;
  const normalizedUnit:ReceiptProduct['unit']=unit.startsWith('k')||unit==='g'?'kg':unit==='l'||unit==='lt'||unit==='ml'?'l':'un';
  try{const total_cents=cents(match[5]),unitCents=match[4]?cents(match[4]):undefined;
   // Quando o cupom traz "qtd x preço", a conta também precisa fechar. Isso evita
   // confirmar uma quantidade que o OCR confundiu com parte do nome ou do código.
   if(unitCents!==undefined&&Math.abs(Math.round(normalized*unitCents)-total_cents)>2)continue;
   if(normalized>0&&total_cents>0)products.push({name:match[1].trim(),quantity:normalized,unit:normalizedUnit,total_cents});
  }catch{/* Linha incerta: não entra na confirmação automática. */}
 }
 return products;
}
export function productsMatchReceiptTotal(products:ReceiptProduct[],total:string){
 try{const expected=cents(total),actual=products.reduce((sum,item)=>sum+item.total_cents,0);return {expected,actual,consistent:products.length>0&&Math.abs(expected-actual)<=1};}
 catch{return {expected:0,actual:products.reduce((sum,item)=>sum+item.total_cents,0),consistent:false};}
}
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
  try{await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK,preserve_interword_spaces:'1'});const result=await worker.recognize(await enhanceReceiptImage(file));text=result.data.text;confidence=result.data.confidence;}finally{await worker.terminate();}
 }
 const total=[...text.matchAll(/(?:valor\s+(?:total|a\s+pagar)|total\s+r?\$?)\s*[:\s]*([\d.,]+)/gi)].at(-1)?.[1]??'';
 const date=text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
 const products=parseReceiptProducts(text),check=productsMatchReceiptTotal(products,total);
 return {text,total,date:date?`${date[3]}-${date[2]}-${date[1]}`:'',merchant:text.split('\n').find(l=>l.trim().length>3)?.trim()??'',confidence,products,productsTotalCents:check.actual,productsConsistent:check.consistent} satisfies ReceiptAnalysis;
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
async function enhanceReceiptImage(file:File){
 if(!file.type.startsWith('image/')||typeof createImageBitmap==='undefined')return file;
 try{const {canvas,context}=await canvasFor(file),pixels=context.getImageData(0,0,canvas.width,canvas.height);
  for(let i=0;i<pixels.data.length;i+=4){const gray=.299*pixels.data[i]+.587*pixels.data[i+1]+.114*pixels.data[i+2],value=Math.max(0,Math.min(255,(gray-130)*1.8+130));pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;}
  context.putImageData(pixels,0,0);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));return blob??file;
 }catch{return file;}
}
export async function checksum(file:File){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export {productKey};

