import Papa from 'papaparse';
import type {Row,Snapshot} from './domain';
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const safe=(v:unknown)=>{const s=String(v??'');return /^[=+\-@\t\r]/.test(s)?"'"+s:s;};
export async function exportReport(rows:Row[],format:'csv'|'xlsx'|'pdf'){
 const data=rows.map(r=>({Data:r.occurred_on,Descrição:r.description,Tipo:r.kind,Categoria:r.category,Estabelecimento:r.merchant,Escopo:r.scope,Valor:(Number(r.amount_cents)/100).toFixed(2),Estado:r.status}));
 if(format==='csv'){
  const sanitized=data.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,safe(value)])));
  const csv='\uFEFF'+Papa.unparse(sanitized);
  downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),'relatorio.csv');
  return;
 }
 if(format==='xlsx'){const ExcelJS=await import('exceljs');const book=new ExcelJS.default.Workbook();const sheet=book.addWorksheet('Lançamentos');sheet.columns=Object.keys(data[0]??{Data:'',Descrição:'',Tipo:'',Categoria:'',Estabelecimento:'',Escopo:'',Valor:'',Estado:''}).map(key=>({header:key,key,width:22}));data.forEach(row=>sheet.addRow(row));sheet.getRow(1).font={bold:true};const buffer=await book.xlsx.writeBuffer();downloadBlob(new Blob([buffer as BlobPart]),'relatorio.xlsx');return;}
 const {jsPDF}=await import('jspdf');const {autoTable}=await import('jspdf-autotable');const pdf=new jsPDF({orientation:'landscape'});pdf.text('Nossa Casa — Relatório',14,15);autoTable(pdf,{startY:22,head:[['Data','Descrição','Tipo','Categoria','Valor (R$)','Estado']],body:data.map(r=>[r.Data,r.Descrição,r.Tipo,r.Categoria,r.Valor,r.Estado]),styles:{fontSize:8}});pdf.save('relatorio.pdf');
}
export function exportData(snapshot:Snapshot){downloadBlob(new Blob([JSON.stringify({format:'nossa-casa',version:1,exportedAt:new Date().toISOString(),data:snapshot},null,2)],{type:'application/json'}),'nossa-casa-dados.json');}
export function parseCSV(text:string){const result=Papa.parse<Record<string,string>>(text,{header:true,skipEmptyLines:true,transformHeader:h=>h.trim().toLowerCase()});if(result.errors.length)throw Error('Não foi possível ler o CSV: '+result.errors[0].message);return result.data;}

