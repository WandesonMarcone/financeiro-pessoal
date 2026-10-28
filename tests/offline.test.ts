import {describe,expect,it,vi} from 'vitest';
import {enqueue,localDB,pendingFor,syncPending} from '../src/offline';

describe('fila offline',()=>{
 it('preserva a chave e remove somente após confirmação',async()=>{
  Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
  await enqueue('u','h',{description:'Teste'},'00000000-0000-4000-8000-000000000001');
  const post=vi.fn().mockResolvedValue(undefined);
  await syncPending('u',post);
  expect(post).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001',{description:'Teste'});
  expect(await pendingFor('u')).toHaveLength(0);
 });
 it('mantém erro para revisão sem repetir silenciosamente',async()=>{
  Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
  await enqueue('u','h',{description:'Conflito'},'00000000-0000-4000-8000-000000000002');
  const post=vi.fn().mockRejectedValue(new Error('Acesso revogado'));
  await syncPending('u',post);
  expect((await localDB.outbox.get('00000000-0000-4000-8000-000000000002'))?.error).toBe('Acesso revogado');
  await syncPending('u',post);
  expect(post).toHaveBeenCalledTimes(1);
 });
});
