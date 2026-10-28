# Progresso
Atualizado em 28/10/2026.

## Entregas
- PRs #1 e #2 integrados à main.
- Migração Supabase 20261028105717 aplicada: famílias, perfis e vínculos com RLS.
- PR #3 ampliado: aplicação React/TypeScript/Vite com login Supabase, verificação de vínculo ativo, perfil próprio, saída, estados de erro e layout responsivo.
- Dependências com versões exatas e package-lock.json. Workflow GitHub Actions para testes e build, com actions fixadas por commit.
- Guia de execução/publicação Cloudflare Pages. Frontend sem variáveis válidas mostra estado de preparação.

## Verificação
- Teste SQL reproduzível tests/identity_rls.sql executado no PostgreSQL: anônimo sem permissão; não convidado sem leitura/escrita; membros A e B isolados; família externa isolada; edição própria permitida; escrita cruzada, troca de dono, exclusão e promoção de vínculo negadas; revogação bloqueia leitura/escrita.
- Todas as fixtures revertidas: zero usuários e zero famílias confirmados.
- Sete testes de interface passaram e build TypeScript/Vite passou.
- Nenhum dado financeiro real foi usado.

## Pendências para concluir Fase 2
Configurar Auth sem signup público, criar os dois usuários de forma segura, implementar convite/definição e recuperação de senha, testar HTTP autenticado, validar acessibilidade e navegação em aparelhos, preparar backup e ensaiar restauração. Publicação Cloudflare ainda não realizada. PWA/offline e módulos financeiros ainda não implementados.

API HTTP pública: consultas às três tabelas responderam 401/42501. Auth settings: disable_signup=false; desabilitar cadastro público antes da publicação. O plugin atual não oferece edição dessa configuração.
