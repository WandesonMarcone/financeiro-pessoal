# Fase 2 — provisionamento de identidade

A migração em `supabase/migrations/20261028105717_identity_family_rls.sql` cria somente famílias, perfis e vínculos. Aplicada em 28/10/2026 ao projeto Free `ucxgyfxyiahtqdsmkkhi` (migração versão `20261028105717`). Tabelas vazias; nenhum usuário real foi cadastrado. Nenhum dado financeiro deve ser criado antes de políticas próprias nas respectivas tabelas.

## Fluxo recomendado
1. Projeto Free criado. Antes de convidar duas pessoas, desabilitar cadastro público em Auth e verificar recuperação de acesso e estratégia de backup. Não publicar URL de convite.
2. Migração aplicada ao projeto ainda vazio. Em transação administrativa, criar uma família e inserir exatamente os dois IDs já existentes em `auth.users` em `memberships`, com `status='active'`. Um papel `manager` não concede leitura extra.
3. Criar perfis somente após vínculo ativo. A aplicação jamais recebe `service_role`, conexão SQL administrativa ou senhas em build.
4. Testar anônimo, usuário autenticado não convidado, cada um dos dois membros e usuário revogado; repetir com outro household. Testar SELECT/INSERT/UPDATE/DELETE, troca forjada de IDs e revogação durante sessão existente.
5. O bucket privado `family-documents` e suas políticas foram criados pela migração financeira; validar upload/download cruzado com as duas contas antes de aceitar documentos reais.
6. Preparar exportação do banco e objetos e ensaiar restauração antes de dados reais.

## Limites atuais
Há projeto Supabase Free, interface de login, schema financeiro/Storage e testes SQL de leitura/escrita para dois membros, pessoa não convidada, família externa e revogado. Falta validar HTTP autenticado, convite, recuperação e restauração completa. Os testes não persistem usuários fictícios. A função de associação permanece em schema privado; a RPC monetária pública é `SECURITY DEFINER`, mas só executa para `authenticated`, revalida toda autorização e foi documentada como aviso conhecido do Advisor. Não há acesso cruzado a perfis: o nome do outro membro não é consultável.

## Matriz mínima a automatizar
| Identidade | Família | Próprio perfil | Vínculo próprio | Escrita de vínculo |
| --- | --- | --- | --- | --- |
| Anônimo | Nega | Nega | Nega | Nega |
| Autenticado sem convite | Nega | Nega | Nega | Nega |
| Membro ativo A/B | Lê sua família | Lê/edita próprio | Lê próprio | Nega |
| Membro revogado | Nega | Nega | Nega | Nega |
| Usuário de outra família | Nega | Lê próprio | Lê próprio | Nega |


## Atualização da base executável
A interface React implementa login por senha, verificação de vínculo, perfil próprio, saída com limpeza local e todos os módulos financeiros descritos em `PROGRESSO.md`. `identity_rls.sql` e `finance_rls.sql` passam em PostgreSQL temporário depois de aplicar as migrações. Quinze testes de interface/domínio/fila e o build PWA passam. Fluxos HTTP autenticados, convite e recuperação ainda não foram validados. Auth ainda apresenta `disable_signup=false`: desativar cadastro público no painel antes de publicar.
