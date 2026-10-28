# Plano de desenvolvimento

Estado em 28/10/2026. Cada fase deve terminar com PR revisável, critérios de aceite e testes apropriados. A numeração funcional original foi mantida; infraestrutura offline e segurança começam cedo.

O PR #3 implementa verticalmente uma primeira versão testável das fases 2 a 10 para evitar telas fictícias: schema, módulos, offline, documentos, relatórios e PWA trabalham juntos. Isso não marca todas as fases como concluídas. Provisionamento dos dois usuários, HTTP ponta a ponta, restauração completa, teste em aparelhos e publicação continuam como critérios bloqueadores.

| Fase | Entrega e dependência | Conclusão verificável |
| --- | --- | --- |
| 1 | Especificação, arquitetura, custos, modelo e estrutura | Documentos revisados; dependências e lacunas explícitas |
| 2 | Projeto local, migrações, Auth, dois membros, RLS e Storage privado básico | Testes de acesso cruzado e de negação para anônimo, não convidado e membro revogado; sem segredo no cliente; backup/restore de teste antes de dados reais |
| 3 | Contas, receitas/despesas, categorias, movimentos, transferências | Saldos corretos, transferências neutras, testes de centavos e idempotência |
| 4 | Despesas da casa, pagador, lista de compras e fluxo simples | Compartilhamento sem exposição de conta privada; dois usuários testados |
| 5 | Cartões, parcelas, faturas, recorrências | Somatório de parcelas, virada de fatura e pagamento sem duplicidade testados |
| 6 | Orçamentos, metas, reservas e patrimônio | Projeções conciliam com movimentos; histórico auditável |
| 7 | Upload privado, notas, QR, OCR e garantias | Documento autenticado, revisão manual, limites de tamanho/armazenamento |
| 8 | Produtos, unidades normalizadas e comparações | Preço por unidade comparável e deduplicação revisável |
| 9 | Fila offline e sincronização robusta; infraestrutura da fila iniciada nas fases 2–3 | Testes de desconexão, repetição, conflito, troca de usuário e recuperação |
| 10 | Exportações, relatórios, auditoria, acessibilidade, PWA e publicação | Testes completos, backup/restauração e revisão de quotas; publicação somente após validação |

Não aguardar fase 9 para IDs de operação, versionamento e escrita idempotente. Fazer prova de conceito offline e de autorização na fase 2. Não declarar fase concluída pela presença de telas. Publicação requer escolha de contas de serviço, cartão se exigido, limites atuais, política de inatividade, backup e restauração.

## Decisões para a fase 2
1. Login: preferir email e senha com cadastro fechado; verificar recuperação e entrega de emails no plano Free. Alternativa OAuth: dependência de provedor externo e configuração, ainda sem decisão.
2. Regra familiar de edição: autor edita; outro lê; correção por outro membro mediante ação explícita e registro de auditoria. Confirmar.
3. Privacidade frente ao operador da infraestrutura: RLS protege membros, não operador privilegiado. Se exigir sigilo até do operador, revisar arquitetura antes de dados reais.
4. Política de backup externo: destino, periodicidade, chave de criptografia e pessoa responsável. Confirmar depois de uma restauração de teste.
5. Limites de anexos: medir estimativa de notas por mês e testar 1 GB de Storage antes de adotar OCR/armazenamento permanente.

