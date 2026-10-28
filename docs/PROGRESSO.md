# Progresso

Atualizado em 28/10/2026.

## Estado
- main: README.md original, sem implementação.
- PR #1: estrutura inicial em rascunho, aberto e mesclável; branch chore/estrutura-desenvolvimento.
- Esta documentação da fase 1: proposta em branch própria derivada da estrutura do PR #1; não mesclada.
- Decisão adicional: informações financeiras acessíveis somente aos usuários autorizados; acesso anônimo, não convidado e revogado negado. A distinção entre administração no app e privilégios da infraestrutura permanece documentada.
- Fase 2 em branch: migração SQL de households, profiles, memberships e RLS proposta; ainda não aplicada nem testada em PostgreSQL.
- Implementado em produção: nenhuma funcionalidade de aplicação.
- Testes de aplicação: indisponíveis, pois ainda não há código, dependências nem ambiente.
- Verificações da fase 1: árvore e branch de base inspecionadas; arquivos novos apenas; revisar árvore e diff do PR de documentação.

## Próximos passos
Revisar decisões pendentes em ESPECIFICACAO_PROJETO.md e PLANO_DESENVOLVIMENTO.md; integrar PR #1 antes do PR dependente; validar migração e políticas RLS com identidades fictícias em PostgreSQL/Supabase local; criar projeto executável, Auth e prova offline na fase 2. Configurar serviço apenas após checar cadastro, quotas e backup.
