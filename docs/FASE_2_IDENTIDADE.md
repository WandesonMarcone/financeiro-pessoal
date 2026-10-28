# Fase 2 — provisionamento de identidade

A migração em `supabase/migrations/20261028105717_identity_family_rls.sql` cria somente famílias, perfis e vínculos. Aplicada em 28/10/2026 ao projeto Free `ucxgyfxyiahtqdsmkkhi` (migração versão `20261028105717`). Dois usuários Auth foram criados, vinculados à família `Nossa Casa` e receberam perfis neutros iniciais. Nenhum dado financeiro real foi criado.

## Fluxo recomendado
1. Projeto Free criado. Antes de convidar duas pessoas, desabilitar cadastro público em Auth e verificar recuperação de acesso e estratégia de backup. Não publicar URL de convite.
2. Migração aplicada ao projeto ainda vazio. Em transação administrativa, criar uma família e inserir exatamente os dois IDs já existentes em `auth.users` em `memberships`, com `status='active'`. Um papel `manager` não concede leitura extra.
3. Criar perfis somente após vínculo ativo. A aplicação jamais recebe `service_role`, conexão SQL administrativa ou senhas em build.
4. Testar anônimo, usuário autenticado não convidado, cada um dos dois membros e usuário revogado; repetir com outro household. Testar SELECT/INSERT/UPDATE/DELETE, troca forjada de IDs e revogação durante sessão existente.
5. O bucket privado `family-documents` e suas políticas foram criados pela migração financeira; validar upload/download cruzado com as duas contas antes de aceitar documentos reais.
6. Preparar exportação do banco e objetos e ensaiar restauração antes de dados reais.

## Limites atuais
Há projeto Supabase Free, interface de login, schema financeiro/Storage e testes SQL de leitura/escrita para dois membros, pessoa não convidada, família externa e revogado. Os dois usuários reais já foram criados, a família `Nossa Casa` foi provisionada e o cadastro público foi desativado. Falta validar HTTP autenticado, recuperação via e-mail e restauração completa. Os testes não persistem usuários fictícios. A função de associação permanece em schema privado; a RPC monetária pública é `SECURITY DEFINER`, mas só executa para `authenticated`, revalida toda autorização e foi documentada como aviso conhecido do Advisor. Não há acesso cruzado a perfis: o nome do outro membro não é consultável.

## Matriz mínima a automatizar
| Identidade | Família | Próprio perfil | Vínculo próprio | Escrita de vínculo |
| --- | --- | --- | --- | --- |
| Anônimo | Nega | Nega | Nega | Nega |
| Autenticado sem convite | Nega | Nega | Nega | Nega |
| Membro ativo A/B | Lê sua família | Lê/edita próprio | Lê próprio | Nega |
| Membro revogado | Nega | Nega | Nega | Nega |
| Usuário de outra família | Nega | Lê próprio | Lê próprio | Nega |


## Atualização da base executável
A interface React implementa login, recuperação/definição de nova senha, verificação de vínculo, perfil próprio, saída com limpeza local e os módulos descritos em `PROGRESSO.md`. `identity_rls.sql` e `finance_rls.sql` passam em PostgreSQL temporário depois das migrações. Dezessete testes e o build PWA passam. Fluxos HTTP autenticados, convite e entrega do e-mail de recuperação ainda não foram validados. O cadastro público está desativado (`disable_signup=true`). O Security Advisor ainda sinaliza a proteção contra senhas vazadas como pendente; ativá-la no painel antes de publicar.
