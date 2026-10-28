import {describe,expect,it} from 'vitest';
import {emptySnapshot} from '../src/domain';
import {DEFAULT_CATEGORIES,seededCategoryRows} from '../src/onboarding';

describe('configuração inicial',()=>{
 it('prepara categorias padrão sem valores financeiros',()=>{
  const rows=seededCategoryRows(emptySnapshot(),'household','user');
  expect(rows.map(row=>row.name)).toEqual([...DEFAULT_CATEGORIES]);
  expect(rows.every(row=>row.scope==='family'&&row.household_id==='household'&&row.owner_user_id==='user')).toBe(true);
 });

 it('não duplica categorias já existentes',()=>{
  const snapshot=emptySnapshot();
  snapshot.categories.push({id:'1',name:'alimentação',archived:false});
  const rows=seededCategoryRows(snapshot,'household','user');
  expect(rows.some(row=>row.name==='Alimentação')).toBe(false);
  expect(rows).toHaveLength(DEFAULT_CATEGORIES.length-1);
 });
});
