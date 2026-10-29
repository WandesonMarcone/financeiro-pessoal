import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Access, Gateway, Ready } from './access';
import {FinanceApp} from './FinanceApp';
type View=Access|{kind:'loading'}|{kind:'error'};
export function App({gateway}:{gateway:Gateway|null}) {
 const [view,setView]=useState<View>({kind:'loading'});
 const [recovery,setRecovery]=useState(false);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  if(!gateway)return;
  let disposed=false,sequence=0,timer:ReturnType<typeof setTimeout>|undefined;
  const refresh=(clear=false)=>{
   const ticket=++sequence;
   if(clear)setView({kind:'loading'});
   // Avoid calling Auth methods within the onAuthStateChange lock.
   clearTimeout(timer);
   timer=setTimeout(()=>{gateway.readAccess().then(access=>{
    if(!disposed&&ticket===sequence)setView(access);
   }).catch(()=>{if(!disposed&&ticket===sequence)setView({kind:'error'});});},0);
  };
  // Android may emit TOKEN_REFRESHED when it returns from the camera/gallery.
  // Keeping the current view mounted is important: otherwise the file input and
  // its in-memory selection are lost while the session is checked again.
  const unsubscribe=gateway.subscribe(event=>{
   if(event==='PASSWORD_RECOVERY')setRecovery(true);
   refresh(event==='SIGNED_OUT'||event==='USER_DELETED');
  });
  refresh(true);
  const revalidate=()=>refresh();
  const poll=setInterval(revalidate,60000);
  window.addEventListener('focus',revalidate);
  window.addEventListener('online',revalidate);
  return ()=>{disposed=true;sequence++;unsubscribe();clearTimeout(timer);clearInterval(poll);window.removeEventListener('focus',revalidate);window.removeEventListener('online',revalidate);};
 },[gateway,revision]);
 const retry=()=>setRevision(n=>n+1);
 return <main className="shell">
  <header><span className="logo" aria-hidden="true">⌂</span><div><strong>Nossa Casa</strong><span className="subtitle">Gestão financeira familiar</span></div></header>
  {!gateway ? <section className="card"><h1>Em preparação</h1><p>O acesso ainda está sendo configurado. Volte em breve.</p></section> : recovery ? <ResetPassword gateway={gateway} onDone={()=>{setRecovery(false);retry();}}/> :
   view.kind==='loading'? <section className="card" role="status"><h1>Verificando acesso…</h1><p>Aguarde um instante.</p></section> :
   view.kind==='signedout'? <Login gateway={gateway} onSuccess={retry}/> :
   view.kind==='ready'? gateway.finance
    ? <FinanceApp key={view.userId} api={gateway.finance} access={view} profile={<Profile gateway={gateway} access={view} onRefresh={retry} onLock={()=>setView({kind:'loading'})}/>}/>
    : <Profile key={view.userId} gateway={gateway} access={view} onRefresh={retry} onLock={()=>setView({kind:'loading'})}/> :
   <section className="card"><h1>{view.kind==='denied'?'Acesso não autorizado':'Não foi possível verificar seu acesso'}</h1><p>{view.kind==='denied'?'Esta conta não possui um convite ativo para a família.':'Confira sua conexão e tente novamente.'}</p><button onClick={retry}>Tentar novamente</button><Logout gateway={gateway} onLock={()=>setView({kind:'loading'})} onDone={retry}/></section>}
  <footer>Acesso exclusivo aos membros autorizados da família.</footer>
 </main>;
}
function Login({gateway,onSuccess}:{gateway:Gateway;onSuccess:()=>void}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{await gateway.signIn(email.trim(),password);setPassword('');onSuccess();}catch{setError('Não foi possível entrar. Confira seus dados e sua conexão.');}finally{setBusy(false);}}
 return <section className="card"><p className="eyebrow">BEM-VINDO À SUA CASA</p><h1>Vamos cuidar das<br/>finanças juntos.</h1><p>Entre com sua conta autorizada.</p><form onSubmit={submit}>
 <label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/>
 <label htmlFor="password">Senha</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/>
 {error&&<p role="alert" className="error">{error}</p>}<button disabled={busy}>{busy?'Entrando…':'Entrar'}</button></form><button className="quiet" disabled={!email.trim()||busy} onClick={async()=>{setBusy(true);setError('');try{await gateway.requestPasswordReset(email.trim());setError('Se esta conta estiver autorizada, enviaremos as instruções de recuperação.');}catch{setError('Não foi possível solicitar a recuperação agora. Tente novamente.');}finally{setBusy(false);}}}>Esqueci minha senha</button><p className="small">O acesso é feito por convite. Não existe cadastro público.</p></section>;
}
function ResetPassword({gateway,onDone}:{gateway:Gateway;onDone:()=>void}){
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event:FormEvent){event.preventDefault();if(password.length<12){setError('Use pelo menos 12 caracteres.');return;}if(password!==confirm){setError('As senhas não coincidem.');return;}setBusy(true);setError('');try{await gateway.updatePassword(password);onDone();}catch{setError('Não foi possível alterar a senha. Solicite um novo link.');}finally{setBusy(false);}}
 return <section className="card"><p className="eyebrow">RECUPERAÇÃO DE ACESSO</p><h1>Defina uma nova senha</h1><p>Depois da alteração, entre novamente para abrir suas finanças.</p><form onSubmit={submit}><label>Nova senha<input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirmar nova senha<input type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<p role="alert" className="error">{error}</p>}<button disabled={busy}>{busy?'Alterando…':'Alterar senha'}</button></form></section>;
}
function Logout({gateway,onLock,onDone}:{gateway:Gateway;onLock:()=>void;onDone:()=>void}){
 const [error,setError]=useState('');
 return <><button className="secondary" onClick={async()=>{setError('');try{await gateway.signOut();onLock();onDone();}catch(e){setError(e instanceof Error?e.message:'Não foi possível sair. Tente novamente.');}}}>Sair e limpar este aparelho</button>{error&&<p role="alert">{error}</p>}</>;
}
function Profile({gateway,access,onRefresh,onLock}:{gateway:Gateway;access:Ready;onRefresh:()=>void;onLock:()=>void}){
 const [name,setName]=useState(access.displayName),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setNotice('');try{
  const current=await gateway.readAccess();
  if(current.kind!=='ready'||current.userId!==access.userId){onLock();onRefresh();return;}
  await gateway.saveProfile(access.userId,name.trim());if(alive.current)setNotice('Seu nome foi salvo.');
 }catch{if(alive.current)setNotice('Não foi possível salvar. Verifique seu acesso e tente novamente.');}finally{if(alive.current)setBusy(false);}}
 return <section className="card"><p className="eyebrow">SUA FAMÍLIA</p><h1>{access.householdName}</h1><p>Seu acesso está ativo. Você pode configurar seu nome abaixo.</p><form onSubmit={save}><label htmlFor="name">Como você quer ser chamado?</label><input id="name" required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/><button disabled={busy||!name.trim()}>{busy?'Salvando…':'Salvar meu nome'}</button></form>{notice&&<p role="status">{notice}</p>}<Logout gateway={gateway} onLock={onLock} onDone={onRefresh}/></section>;
}

