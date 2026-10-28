# Arquitetura e viabilidade

Estado: arquitetura proposta, sujeita a prova de conceito e revisão dos planos gratuitos. Revisão de fontes em 28/10/2026.

## Escolha inicial recomendada
React + TypeScript + Vite para cliente PWA; Tailwind CSS para estilos; IndexedDB para fila/cache; PostgreSQL em Supabase para Auth, dados com RLS e Storage privado; Cloudflare Pages para frontend estático. Bibliotecas de gráficos e exportação serão escolhidas por licença e tamanho de bundle na etapa correspondente. Nenhuma conta de serviço ou infraestrutura foi provisionada nesta fase.

A escolha reduz operação de servidor 24 h, usa padrões abertos e mantém SQL/migrações versionadas. Supabase é conveniência operacional, não abstração de segurança: políticas SQL serão autoridade final. O cliente pode usar chave pública, nunca service_role. Evitar Pages Functions para lógica principal; elas introduzem outra quota e regras de autorização. PWA offline não garante background sync no iOS: reenviar ao abrir app/com conectividade.

## Plano gratuito (verificar antes da ativação)
| Serviço | Limites relevantes | Risco e mitigação |
| --- | --- | --- |
| Supabase Free | 500 MB de banco por projeto; 1 GB Storage; 5 GB egress; 50 mil MAU; API requests anunciadas como ilimitadas; pausa após cerca de 1 semana de inatividade; backups automáticos baixáveis indisponíveis | Duas pessoas cabem em MAU; notas/PDFs podem esgotar Storage primeiro. Medir uso, comprimir imagens sem destruir originais necessários, impor limite, exportar banco e objetos separadamente. Pausa afeta sincronização. |
| Cloudflare Pages Free | 500 builds/mês, 1 build simultâneo, 20 minutos por build, 20 mil arquivos e 25 MiB por arquivo; ativos estáticos sem quota de requests; Functions usam quota Workers Free (100 mil/dia) | Hospedar somente bundle estático; monitorar builds e evitar Functions para operações essenciais. Git privado é suportado. |

Supabase Free não garante serviço sempre ativo ou backup gerenciado. Exceder quota pode restringir serviço; gratuito não equivale a SLA. Custo zero é plausível para família de dois usuários com limites, mas depende do volume de notas e do padrão de uso. Cloudflare e Supabase podem alterar planos. Não foi encontrada confirmação suficiente de exigência de cartão para criar contas Free; confirmar no fluxo de cadastro antes de ativar. A documentação de billing afirma que planos pagos exigem cartão, o que não prova o requisito para Free. Domínio próprio é opcional e pode custar.

Fontes oficiais: [Supabase pricing](https://supabase.com/pricing), [billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [FAQ de quotas](https://supabase.com/docs/guides/platform/billing-faq), [produção/pausa](https://supabase.com/docs/guides/deployment/going-into-prod), [backups](https://supabase.com/docs/guides/platform/backups), [Cloudflare Pages limites](https://developers.cloudflare.com/pages/platform/limits/), [Pages Functions preços](https://developers.cloudflare.com/pages/functions/pricing/), [Git privado](https://developers.cloudflare.com/pages/get-started/git-integration/).

## Modelo de dados planejado
- auth.users (provedor); profiles(user_id, display_name); households(id); memberships(household_id,user_id,role,status), UNIQUE(household_id,user_id).
- accounts(id,household_id,owner_user_id,name,opening_balance,visibility); cards(id,household_id,owner_user_id,closing_day,due_day,limit); categories(id,household_id,owner_user_id nullable,name,parent_id).
- transactions(id,household_id,scope,owner_user_id,payer_user_id,kind,amount_cents,currency,occurred_on,category_id,merchant_id,account_id nullable,card_id nullable,status,client_operation_id,version,created_by); UNIQUE(created_by,client_operation_id). kind distingue receita, despesa, transferência e ajuste; restrições impedem combinação inválida. Contas/cartões pessoais não são expostos por joins de transações familiares.
- transfers(id,household_id,source_account_id,target_account_id,amount_cents,...) com movimentos vinculados atômicos; nunca representadas como receitas.
- card_purchases(id,card_id,household_id,scope,owner_user_id,payer_user_id,amount_cents,installments,...); card_installments(id,purchase_id,number,due_on,amount_cents,invoice_id), soma exata das parcelas; invoices(id,card_id,period,status); invoice_payments(id,invoice_id,account_id,amount_cents).
- recurring_rules, budgets, goals, goal_contributions, assets, merchants, products, product_aliases, units, shopping_lists, shopping_items.
- documents(id,household_id,scope,owner_user_id,storage_key,mime_type,size,checksum,uploaded_by); document_links/document_items; expense/documento associado; audit_events(id,actor_user_id,entity,entity_id,action,occurred_at,redacted_changes). Histórico com acesso no mesmo escopo.
- Todas as chaves externas de dados financeiros devem manter consistência de household e dono. Índices em household, owner, data, status; soft delete/estorno quando necessário. Não usar saldos derivados como fonte única: razão/movimentos imutáveis e projeções recalculáveis.

## Matriz de autorização planejada
| Recurso | Dono | Outro membro | Administrador técnico |
| --- | --- | --- | --- |
| Conta, cartão, receita e despesa pessoal | Ler/escrever | Sem acesso | Sem privilégio pelo papel no app |
| Despesa familiar, lista e documento familiar | Ler; editar conforme autoria/regra | Ler; editar conforme autoria/regra | Sem privilégio pelo papel técnico |
| Documento pessoal | Ler/escrever | Sem acesso | Sem privilégio pelo papel no app |
| Perfil e associação familiar | Próprio perfil; gestão de convite conforme papel | Próprio perfil | Gestão limitada de configuração |

RLS com auth.uid(), membership ativo e predicados de escopo para SELECT/INSERT/UPDATE/DELETE; WITH CHECK em toda escrita; negar por padrão, inclusive tabelas auxiliares, Storage e views/RPCs. Não confiar em owner_user_id ou household_id vindos do browser sem validar associação e origem. Service role ignora RLS: restringir a tarefas administrativas isoladas com segredo fora do cliente e trilha de acesso. O operador da conta Supabase ou do banco pode ter acesso técnico ao banco; o requisito de confidencialidade frente ao próprio administrador da infraestrutura requer criptografia ponta a ponta e gestão de chaves separada, que não está resolvida.

## Offline e migração
Fila IndexedDB por usuário e dispositivo, IDs UUID, idempotência no servidor, versão esperada para alterações, escrita atômica e resposta canônica. Conflito: manter cópia local, informar diferenças e pedir resolução em campos financeiros; não usar último escritor silencioso. Logout limpa cache e chaves locais do usuário. Cache em dispositivo compartilhado exige análise de proteção em repouso; PWA/IndexedDB não oferece isolamento criptográfico automático.

Versionar schema e RLS em migrações SQL; exportar periodicamente SQL/CSV e objetos privados, com checksums e metadados, guardar backup criptografado fora do provedor, testar restauração em ambiente isolado. Dump do banco não inclui arquivos Storage. URLs de objetos não são chaves portáveis; usar storage_key lógico e adaptador. Auth pode demandar remapeamento de IDs na migração. [Exportar objetos](https://supabase.com/docs/guides/storage/management/download-objects), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
