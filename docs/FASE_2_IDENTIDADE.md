# Fase 2 — provisionamento de identidade

A migração em `supabase/migrations/202610280001_identity.sql` cria somente famílias, perfis e vínculos. Sem projeto Supabase configurado, ela **não foi aplicada**. Nenhum dado financeiro deve ser criado antes de políticas próprias nas respectivas tabelas.

## Fluxo recomendado
1. Criar projeto Supabase Free após confirmar cadastro, quotas e estratégia de backup. Desabilitar cadastro público em Auth; criar dois usuários por convite administrativo. Não publicar URL de convite.
2. Aplicar a migração em ambiente de teste. Em transação administrativa, criar uma família e inserir exatamente os dois IDs já existentes em `auth.users` em `memberships`, com `status='active'`. Um papel `manager` não concede leitura extra.
3. Criar perfis somente após vínculo ativo. A aplicação jamais recebe `service_role`, conexão SQL administrativa ou senhas em build.
4. Testar anônimo, usuário autenticado não convidado, cada um dos dois membros e usuário revogado; repetir com outro household. Testar SELECT/INSERT/UPDATE/DELETE, troca forjada de IDs e revogação durante sessão existente.
5. Configurar bucket privado e suas políticas antes de aceitar upload; ainda não existe Storage nesta fase.
6. Preparar exportação do banco e objetos e ensaiar restauração antes de dados reais.

## Limites atuais
Não há frontend, login interativo, recuperação de senha, servidor provisionado nem testes SQL executados. A função `security definer` deve ser revisada no ambiente alvo: proprietário da função precisa ter acesso à tabela de vínculos; nenhum usuário comum deve poder alterá-la. Não há acesso cruzado autorizado a perfis: o display_name do outro membro não é consultável por esta versão.

## Matriz mínima a automatizar
| Identidade | Família | Próprio perfil | Vínculo próprio | Escrita de vínculo |
| --- | --- | --- | --- | --- |
| Anônimo | Nega | Nega | Nega | Nega |
| Autenticado sem convite | Nega | Nega | Nega | Nega |
| Membro ativo A/B | Lê sua família | Lê/edita próprio | Lê próprio | Nega |
| Membro revogado | Nega | Nega | Nega | Nega |
| Usuário de outra família | Nega | Lê próprio | Lê próprio | Nega |
