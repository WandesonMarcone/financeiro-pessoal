# Progresso

Atualizado em 28/10/2026.

## Concluído
- PR #1 e PR #2 integrados à main: estrutura e documentação da Fase 1.
- Supabase Free: projeto `ucxgyfxyiahtqdsmkkhi` ativo; migração `20261028105717_identity_family_rls` aplicada; `households`, `profiles`, `memberships` com RLS ativo.
- Verificação: security advisor sem alertas; teste SQL transacional com dados fictícios passou para negação a anônimo e não convidado, escopo de membro A e revogação. A primeira tentativa do teste errou ao consultar tabela sem privilégio como anônimo; foi corrigida. Após rollback, 0 usuários fictícios e 0 famílias.

## Em andamento
- PR #3: arquivo de migração e guia da Fase 2. Migração remota aplicada, mas PR ainda em rascunho até testes de escrita, membro B, outra família e API HTTP.
- Nenhum usuário real, perfil familiar, documento ou dado financeiro foi cadastrado. Frontend/login, Storage e backup/restauração pendentes.

## Próximas etapas
Conferir Auth (bloquear cadastro público e fluxo de convite); testar permissões de escrita e acesso cruzado com dados fictícios; criar interface de login e validar via API; preparar exportação e restauração antes de dados reais. Não declarar Fase 2 concluída antes dessas verificações.
