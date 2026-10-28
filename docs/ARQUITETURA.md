# Arquitetura e viabilidade

Estado: arquitetura implementada na branch do PR #3; publicação e usuários reais ainda bloqueados. Revisão de fontes em 28/10/2026.

## Escolha inicial recomendada
React 19 + TypeScript + Vite para cliente PWA; CSS responsivo próprio; Dexie/IndexedDB para fila/cache por usuário; PostgreSQL em Supabase para Auth, dados com RLS e Storage privado; Cloudflare Pages para frontend estático. Relatórios usam CSV, ExcelJS e jsPDF; Tesseract.js, PDF.js e ZXing processam OCR/PDF/QR no navegador. O projeto Supabase Free foi provisionado e recebeu as migrações; Cloudflare Pages ainda não foi conectado.

A escolha reduz operação de servidor 24 h, usa padrões abertos e mantém SQL/migrações versionadas. Supabase é conveniência operacional, não abstração de segurança: políticas SQL serão autoridade final. O cliente pode usar chave pública, nunca service_role. Evitar Pages Functions para lógica principal; elas introduzem outra quota e regras de autorização. PWA offline não garante background sync no iOS: reenviar ao abrir app/com conectividade.

## Plano gratuito (verificar antes da ativação)
| Serviço | Limites relevantes | Risco e mitigação |
| --- | --- | --- |
| Supabase Free | 500 MB de banco por projeto; 1 GB Storage; 5 GB egress; 50 mil MAU; API requests anunciadas como ilimitadas; pausa após cerca de 1 semana de inatividade; backups automáticos baixáveis indisponíveis | Duas pessoas cabem em MAU; notas/PDFs podem esgotar Storage primeiro. Medir uso, comprimir imagens sem destruir originais necessários, impor limite, exportar banco e objetos separadamente. Pausa afeta sincronização. |
| Cloudflare Pages Free | 500 builds/mês, 1 build simultâneo, 20 minutos por build, 20 mil arquivos e 25 MiB por arquivo; ativos estáticos sem quota de requests; Functions usam quota Workers Free (100 mil/dia) | Hospedar somente bundle estático; monitorar builds e evitar Functions para operações essenciais. Git privado é suportado. |

Supabase Free não garante serviço sempre ativo ou backup gerenciado. Exceder quota pode restringir serviço; gratuito não equivale a SLA. Custo zero é plausível para família de dois usuários com limites, mas depende do volume de notas e do padrão de uso. Cloudflare e Supabase podem alterar planos. Não foi encontrada confirmação suficiente de exigência de cartão para criar contas Free; confirmar no fluxo de cadastro antes de ativar. A documentação de billing afirma que planos pagos exigem cartão, o que não prova o requisito para Free. Domínio próprio é opcional e pode custar.

Fontes oficiais: [Supabase pricing](https://supabase.com/pricing), [billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [FAQ de quotas](https://supabase.com/docs/guides/platform/billing-faq), [produção/pausa](https://supabase.com/docs/guides/deployment/going-into-prod), [backups](https://supabase.com/docs/guides/platform/backups), [Cloudflare Pages limites](https://developers.cloudflare.com/pages/platform/limits/), [Pages Functions preços](https://developers.cloudflare.com/pages/functions/pricing/), [Git privado](https://developers.cloudflare.com/pages/get-started/git-integration/).

## Modelo de dados implementado
- `auth.users` (provedor), `profiles`, `households` e `memberships` formam a identidade; associação é provisionada administrativamente, sem cadastro pelo cliente.
- `accounts` e `cards` têm autoria preservada, mas são legíveis por todos os membros ativos da família. `transactions` contém o fato financeiro; origem bancária fica em `ledger_entries` e cartão/parcelas em `card_installments`, também legíveis na mesma família. Escrita continua restrita ao autor e às validações da RPC.
- `post_transaction(operation_id,payload)` registra receita, despesa, transferência, compra no cartão, pagamento ou estorno em uma única transação SQL. `finance_operations(user_id,id,payload,result_id)` garante repetição idempotente e rejeita o mesmo ID com conteúdo diferente.
- Transferência cria dois movimentos cuja soma é zero. Compra no cartão cria a despesa uma vez e parcelas exatas; `invoice_payments` reduz conta/fatura sem criar outra despesa.
- Cadastros versionados: `categories`, `budgets`, `goals`, `goal_contributions`, `assets`, `shopping_items`, `recurring_rules`, `due_items`, `documents` e `receipt_items`. Triggers impedem troca de dono/família e validam relações pai-filho.
- `audit_events` preserva criação/alteração/estorno. Exclusão financeira não é concedida ao cliente; recursos auxiliares usam arquivamento. Índices cobrem chaves externas e caminhos de consulta/RLS.

## Matriz de autorização implementada
| Recurso | Dono | Outro membro | Administrador técnico |
| --- | --- | --- | --- |
| Conta, cartão, receitas, despesas, faturas e movimentos | Ler/escrever os próprios | Ler | Sem privilégio pelo papel no app |
| Lista, documento, orçamento, meta, patrimônio e relatórios | Ler; editar conforme autoria/regra | Ler | Sem privilégio pelo papel técnico |
| Auditoria | Ler os eventos da família; escrita pelo sistema | Ler | Sem privilégio pelo papel no app |
| Perfil e associação familiar | Próprio perfil; gestão de convite conforme papel | Próprio perfil | Gestão limitada de configuração |

Negar todas as consultas e mutações para auth.uid() nulo, conta não convidada, membro inativo/removido e usuário de outra família; não publicar dados financeiros em páginas estáticas, pré-visualizações, logs ou caches compartilhados. Os arquivos públicos do frontend podem ser servidos pelo Pages, mas carregam somente código e recursos sem dados da família. RLS com auth.uid(), membership ativo e predicados de escopo para SELECT/INSERT/UPDATE/DELETE; WITH CHECK em toda escrita; negar por padrão, inclusive tabelas auxiliares, Storage e views/RPCs. Não confiar em owner_user_id ou household_id vindos do browser sem validar associação e origem. Service role ignora RLS: restringir a tarefas administrativas isoladas com segredo fora do cliente e trilha de acesso. O operador da conta Supabase ou do banco pode ter acesso técnico ao banco; o requisito de confidencialidade frente ao próprio administrador da infraestrutura requer criptografia ponta a ponta e gestão de chaves separada, que não está resolvida.

## Offline e migração
Fila IndexedDB por usuário e dispositivo, UUID, idempotência no servidor, versão esperada, escrita atômica e resposta canônica. Conflitos ficam visíveis para revisão; não há “último escritor vence” silencioso. Logout limpa snapshot, preferências e fila local. Se houver pendências, a saída é bloqueada até sincronizar, exportar ou descartar. Cache em dispositivo compartilhado ainda exige bloqueio do aparelho; PWA/IndexedDB não oferece criptografia em repouso controlada pelo aplicativo.

Versionar schema e RLS em migrações SQL; exportar periodicamente SQL/CSV e objetos privados, com checksums e metadados, guardar backup criptografado fora do provedor, testar restauração em ambiente isolado. Dump do banco não inclui arquivos Storage. URLs de objetos não são chaves portáveis; usar storage_key lógico e adaptador. Auth pode demandar remapeamento de IDs na migração. [Exportar objetos](https://supabase.com/docs/guides/storage/management/download-objects), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

