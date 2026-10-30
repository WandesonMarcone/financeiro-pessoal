import React from 'react';
import {act,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe,it,expect,vi} from 'vitest';
import {App} from '../src/App';
import type {Access,Gateway,Ready} from '../src/access';
const ready:Ready={kind:'ready',userId:'a',householdId:'family',householdName:'Casa de teste',displayName:'Pessoa A'};
function fake(access:Access={kind:'signedout'}) {
 let callback:(event?:string)=>void=()=>{};
 const gateway:Gateway={
 readAccess:vi.fn().mockResolvedValue(access),subscribe:vi.fn(cb=>{callback=cb;return()=>{};}),
 signIn:vi.fn().mockResolvedValue(undefined),signOut:vi.fn().mockResolvedValue(undefined),requestPasswordReset:vi.fn().mockResolvedValue(undefined),updatePassword:vi.fn().mockResolvedValue(undefined),getProfile:vi.fn().mockResolvedValue({email:'pessoa@example.invalid',avatarUrl:''}),getUsage:vi.fn().mockResolvedValue({documents:2,photos:1,documentBytes:1048576,transactions:3,receiptItems:4,recurringRules:1,cards:1}),saveProfile:vi.fn().mockResolvedValue(undefined),updateEmail:vi.fn().mockResolvedValue(undefined),changePassword:vi.fn().mockResolvedValue(undefined)
 };return {gateway,notify:(event?:string)=>callback(event)};
}
describe('acesso privado',()=>{
 it('não apresenta formulário sem configuração',()=>{render(<App gateway={null}/>);expect(screen.getByText('Em preparação')).toBeInTheDocument();expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();});
 it('faz login real pelo gateway e informa falhas sem detalhes internos',async()=>{
 const {gateway}=fake();vi.mocked(gateway.signIn).mockRejectedValue(new Error('segredo do servidor'));
 render(<App gateway={gateway}/>);await screen.findByLabelText('E-mail');
 const user=userEvent.setup();await user.type(screen.getByLabelText('E-mail'),'a@example.invalid');await user.type(screen.getByLabelText('Senha'),'senha');await user.click(screen.getByRole('button',{name:'Entrar'}));
 expect(gateway.signIn).toHaveBeenCalledWith('a@example.invalid','senha');expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível entrar');expect(screen.queryByText('segredo do servidor')).not.toBeInTheDocument();
 });
 it('nega conta sem vínculo',async()=>{const {gateway}=fake({kind:'denied'});render(<App gateway={gateway}/>);expect(await screen.findByText('Acesso não autorizado')).toBeInTheDocument();expect(screen.queryByLabelText('Como você quer ser chamado?')).not.toBeInTheDocument();});
 it('solicita recuperação sem revelar se o e-mail existe',async()=>{const {gateway}=fake();render(<App gateway={gateway}/>);const user=userEvent.setup();await user.type(await screen.findByLabelText('E-mail'),'pessoa@example.invalid');await user.click(screen.getByRole('button',{name:'Esqueci minha senha'}));expect(gateway.requestPasswordReset).toHaveBeenCalledWith('pessoa@example.invalid');expect(await screen.findByRole('alert')).toHaveTextContent('Se esta conta estiver autorizada');});
 it('aceita o retorno de recuperação e exige uma senha forte confirmada',async()=>{const {gateway,notify}=fake();render(<App gateway={gateway}/>);await screen.findByLabelText('E-mail');act(()=>notify('PASSWORD_RECOVERY'));const user=userEvent.setup();await user.type(await screen.findByLabelText('Nova senha'),'uma-senha-forte-123');await user.type(screen.getByLabelText('Confirmar nova senha'),'uma-senha-forte-123');await user.click(screen.getByRole('button',{name:'Alterar senha'}));await waitFor(()=>expect(gateway.updatePassword).toHaveBeenCalledWith('uma-senha-forte-123'));});
 it('salva perfil do usuário atual após revalidar o acesso',async()=>{const {gateway}=fake(ready);render(<App gateway={gateway}/>);const input=await screen.findByLabelText('Como você quer ser chamado?');const user=userEvent.setup();await user.clear(input);await user.type(input,'Novo nome');await user.click(screen.getByRole('button',{name:'Salvar perfil'}));expect(await screen.findByText('Perfil salvo.')).toBeInTheDocument();expect(gateway.saveProfile).toHaveBeenCalledWith('a','Novo nome',undefined);});
 it('mostra o consumo da família sem expor a cota administrativa',async()=>{const {gateway}=fake(ready);render(<App gateway={gateway}/>);expect(await screen.findByText('Uso do sistema')).toBeInTheDocument();expect(await screen.findByText('1.00 MB')).toBeInTheDocument();expect(gateway.getUsage).toHaveBeenCalled();});
 it('bloqueia gravação quando o vínculo foi revogado',async()=>{const {gateway}=fake(ready);render(<App gateway={gateway}/>);await screen.findByLabelText('Como você quer ser chamado?');vi.mocked(gateway.readAccess).mockResolvedValue({kind:'denied'});await userEvent.click(screen.getByRole('button',{name:'Salvar perfil'}));expect(await screen.findByText('Acesso não autorizado')).toBeInTheDocument();expect(gateway.saveProfile).not.toHaveBeenCalled();});
 it('descarta resposta atrasada de uma sessão anterior',async()=>{
 const {gateway,notify}=fake();let finish!:(a:Access)=>void;
 vi.mocked(gateway.readAccess).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue({kind:'signedout'});
 render(<App gateway={gateway}/>);await waitFor(()=>expect(gateway.readAccess).toHaveBeenCalledTimes(1));
 act(()=>notify());await screen.findByLabelText('Senha');await act(async()=>finish(ready));expect(screen.queryByText('Casa de teste')).not.toBeInTheDocument();
 });
 it('oculta informações quando a verificação falha',async()=>{const {gateway}=fake();vi.mocked(gateway.readAccess).mockRejectedValue(new Error('offline'));render(<App gateway={gateway}/>);expect(await screen.findByText('Não foi possível verificar seu acesso')).toBeInTheDocument();expect(screen.queryByText('Casa de teste')).not.toBeInTheDocument();});
});

