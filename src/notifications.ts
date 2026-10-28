import type {Row} from './domain';

export function notificationsAvailable(){return typeof window!=='undefined'&&'Notification' in window;}

export async function enableNotifications(){
 if(!notificationsAvailable())return false;
 const permission=Notification.permission==='granted'? 'granted':await Notification.requestPermission();
 return permission==='granted';
}

export function notifyDueItems(items:Row[]){
 if(!notificationsAvailable()||Notification.permission!=='granted')return 0;
 const today=new Date().toISOString().slice(0,10);
 let sent=0;
 for(const item of items.filter(row=>!row.paid_transaction_id)){
  const key=`nossa-casa:reminder:${item.id}:${today}`;
  if(localStorage.getItem(key))continue;
  new Notification(item.due_on<today?'Conta vencida':'Conta a vencer',{body:`${item.description} · ${item.due_on}`,tag:item.id});
  localStorage.setItem(key,'1');sent++;
 }
 return sent;
}
