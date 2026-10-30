import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Access, Gateway, Ready, Usage } from './access';
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
 const [name,setName]=useState(access.displayName),[photo,setPhoto]=useState<File>(),[avatar,setAvatar]=useState(''),[email,setEmail]=useState(''),[usage,setUsage]=useState<Usage>(),[current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{void Promise.all([gateway.getProfile(),gateway.getUsage()]).then(([profile,currentUsage])=>{if(alive.current){setEmail(profile.email);setAvatar(profile.avatarUrl);setUsage(currentUsage);}}).catch(()=>{if(alive.current)setNotice('Não foi possível carregar os dados de perfil.');});},[gateway]);
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setNotice('');try{
  const current=await gateway.readAccess();
  if(current.kind!=='ready'||current.userId!==access.userId){onLock();onRefresh();return;}
  await gateway.saveProfile(access.userId,name.trim(),photo);if(photo){const profile=await gateway.getProfile();setAvatar(profile.avatarUrl);setPhoto(undefined);}if(alive.current)setNotice('Perfil salvo.');
 }catch{if(alive.current)setNotice('Não foi possível salvar. Verifique seu acesso e tente novamente.');}finally{if(alive.current)setBusy(false);}}
 async function emailChange(e:FormEvent){e.preventDefault();setBusy(true);setNotice('');try{await gateway.updateEmail(email.trim());setNotice('Confirme a troca pelo link enviado ao e-mail novo. Até lá, o e-mail atual continua valendo.');}catch{setNotice('Não foi possível solicitar a troca de e-mail.');}finally{setBusy(false);}}
 async function passwordChange(e:FormEvent){e.preventDefault();if(next.length<12){setNotice('A nova senha deve ter pelo menos 12 caracteres.');return;}if(next!==confirm){setNotice('As novas senhas não coincidem.');return;}setBusy(true);setNotice('');try{await gateway.changePassword(current,next);setCurrent('');setNext('');setConfirm('');setNotice('Senha alterada com segurança.');}catch{setNotice('Não foi possível alterar a senha. Confira a senha atual.');}finally{setBusy(false);}}
 return <section className="card"><p className="eyebrow">SUA FAMÍLIA</p><h1>{access.householdName}</h1><p>Seu acesso está ativo. Gerencie seus dados de conta abaixo.</p><section className="profile-usage" aria-label="Uso do sistema"><h2>Uso do sistema</h2>{usage?<><div className="usage-grid"><span><strong>{usage.documents}</strong> documentos</span><span><strong>{usage.photos}</strong> fotos</span><span><strong>{(usage.documentBytes/1024/1024).toFixed(2)} MB</strong> guardados</span><span><strong>{usage.transactions}</strong> lançamentos</span><span><strong>{usage.receiptItems}</strong> produtos lidos</span><span><strong>{usage.recurringRules}</strong> recorrências</span></div><p className="small">Estes números mostram o que a família usa neste aplicativo. A cota total do projeto Supabase é administrativa e fica apenas no painel do Supabase; ela não é exposta ao site, pois exigiria uma credencial privilegiada.</p></>:<p className="small">Calculando uso da família…</p>}</section><form onSubmit={save}><label>Foto de perfil<input type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={e=>setPhoto(e.target.files?.[0])}/></label>{avatar&&<img src={avatar} alt="Sua foto de perfil" className="avatar"/>}<label htmlFor="name">Como você quer ser chamado?</label><input id="name" required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/><button disabled={busy||!name.trim()}>{busy?'Salvando…':'Salvar perfil'}</button></form><hr/><form onSubmit={emailChange}><h2>Alterar e-mail</h2><p className="small">A mudança só vale após a confirmação enviada por e-mail.</p><label>Novo e-mail<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><button disabled={busy}>Solicitar troca de e-mail</button></form><hr/><form onSubmit={passwordChange}><h2>Alterar senha</h2><label>Senha atual<input type="password" required autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)}/></label><label>Nova senha<input type="password" required autoComplete="new-password" value={next} onChange={e=>setNext(e.target.value)}/></label><label>Confirmar nova senha<input type="password" required autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><button disabled={busy}>Alterar senha</button></form>{notice&&<p role="status">{notice}</p>}<Logout gateway={gateway} onLock={onLock} onDone={onRefresh}/></section>;
}

