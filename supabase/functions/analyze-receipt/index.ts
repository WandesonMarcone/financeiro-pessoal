import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"https://wandesonmarcone.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const schema={type:"object",additionalProperties:false,required:["merchant","date","paymentMethod","subtotal","discount","total","products"],properties:{merchant:{type:"string"},date:{type:"string"},paymentMethod:{type:"string"},subtotal:{type:"string"},discount:{type:"string"},total:{type:"string"},products:{type:"array",items:{type:"object",additionalProperties:false,required:["name","brand","quantity","unit","unitPrice","total","category"],properties:{name:{type:"string"},brand:{type:"string"},quantity:{type:"number"},unit:{type:"string",enum:["un","kg","l"]},unitPrice:{type:"string"},total:{type:"string"},category:{type:"string",enum:["Alimentação","Bebidas","Higiene pessoal","Limpeza","Combustível","Lanche","Saúde","Outros"]}}}}}};
function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:cors});}
function toBase64(bytes:Uint8Array){let value='';for(let start=0;start<bytes.length;start+=0x8000)value+=String.fromCharCode(...bytes.subarray(start,start+0x8000));return btoa(value);}

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Método não permitido.'},405);
 try{
  const authorization=req.headers.get('Authorization');if(!authorization)return json({error:'Entre novamente para analisar uma nota.'},401);
  const keys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')??'{}');
  const client=createClient(Deno.env.get('SUPABASE_URL')!,keys.default??Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}}});
  const {data:{user},error:userError}=await client.auth.getUser();if(userError||!user)return json({error:'Sessão inválida.'},401);
  const {data:membership,error:membershipError}=await client.from('memberships').select('household_id').eq('user_id',user.id).eq('status','active').maybeSingle();
  if(membershipError||!membership)return json({error:'Acesso à família não autorizado.'},403);
  const form=await req.formData(),file=form.get('receipt');if(!(file instanceof File)||!file.type.startsWith('image/')||file.size>4*1024*1024)return json({error:'Envie uma imagem de nota com até 4 MB.'},400);
  const key=Deno.env.get('OPENAI_API_KEY');if(!key)return json({error:'A análise por IA ainda não está configurada.'},503);
  const prompt='Leia esta nota fiscal brasileira. Extraia somente o que estiver legível. Valores em reais com vírgula e duas casas. Produtos não podem ser repetidos: preserve uma linha por item fiscal, inclusive itens iguais em linhas diferentes. Para peso use kg; para unidade use un; para líquidos use l. Extraia a marca separadamente do nome do produto, quando ela estiver impressa; se não estiver legível, deixe brand vazia. Classifique cada item em uma das categorias fornecidas. Não complete dados incertos: use string vazia ou produtos vazios. O total deve ser o valor pago.';
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4.1-mini',max_output_tokens:1800,input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:`data:${file.type};base64,${toBase64(new Uint8Array(await file.arrayBuffer()))}`,detail:'high'}]}],text:{format:{type:'json_schema',name:'receipt_analysis',strict:true,schema}}})});
  if(!response.ok){console.error('OpenAI receipt analysis failed',response.status);return json({error:'Não foi possível analisar esta foto agora.'},502);}
  const output=await response.json(),raw=output.output_text;if(typeof raw!=='string')return json({error:'A IA não retornou uma leitura utilizável.'},502);
  return json(JSON.parse(raw));
 }catch(error){console.error('Receipt analysis error',error instanceof Error?error.message:'unknown');return json({error:'Não foi possível analisar esta nota.'},500);}
});
