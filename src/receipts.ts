import {productKey} from './domain';
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
  const worker=await createWorker('por',1,{workerPath:'/tesseract/worker.min.js',corePath:'/tesseract/tesseract-core-lstm.wasm.js',langPath:'/tesseract',logger:m=>progress(m.status==='recognizing text'?'Lendo nota: '+Math.round(m.progress*100)+'%':'Preparando leitura…')});
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

