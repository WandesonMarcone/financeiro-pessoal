# Fase 2 — provisionamento de identidade

A migração em `supabase/migrations/20261028105717_identity_family_rls.sql` cria somente famílias, perfis e vínculos. Aplicada em 28/10/2026 ao projeto Free `ucxgyfxyiahtqdsmkkhi` (migração versão `20261028105717`). Tabelas vazias; nenhum usuário real foi cadastrado. Nenhum dado financeiro deve ser criado antes de políticas próprias nas respectivas tabelas.

## Fluxo recomendado
1. Projeto Free criado. Antes de convidar duas pessoas, desabilitar cadastro público em Auth e verificar recuperação de acesso e estratégia de backup. Não publicar URL de convite.
2. Migração aplicada ao projeto ainda vazio. Em transação administrativa, criar uma família e inserir exatamente os dois IDs já existentes em `auth.users` em `memberships`, com `status='active'`. Um papel `manager` não concede leitura extra.
3. Criar perfis somente após vínculo ativo. A aplicação jamais recebe `service_role`, conexão SQL administrativa ou senhas em build.
4. Testar anônimo, usuário autenticado não convidado, cada um dos dois membros e usuário revogado; repetir com outro household. Testar SELECT/INSERT/UPDATE/DELETE, troca forjada de IDs e revogação durante sessão existente.
5. Configurar bucket privado e suas políticas antes de aceitar upload; ainda não existe Storage nesta fase.
6. Preparar exportação do banco e objetos e ensaiar restauração antes de dados reais.

## Limites atuais
Há projeto Supabase Free e teste SQL transacional de leitura de anônimo, não convidado, membro A e revogado. Falta frontend, login interativo, recuperação, testes de escrita, membro B, família externa e teste pela API HTTP. O teste foi revertido sem persistir usuários fictícios. A função `security definer` deve ser revisada no ambiente alvo: proprietário da função precisa ter acesso à tabela de vínculos; nenhum usuário comum deve poder alterá-la. Não há acesso cruzado autorizado a perfis: o display_name do outro membro não é consultável por esta versão.

## Matriz mínima a automatizar
| Identidade | Família | Próprio perfil | Vínculo próprio | Escrita de vínculo |
| --- | --- | --- | --- | --- |
| Anônimo | Nega | Nega | Nega | Nega |
| Autenticado sem convite | Nega | Nega | Nega | Nega |
| Membro ativo A/B | Lê sua família | Lê/edita próprio | Lê próprio | Nega |
| Membro revogado | Nega | Nega | Nega | Nega |
| Usuário de outra família | Nega | Lê próprio | Lê próprio | Nega |
