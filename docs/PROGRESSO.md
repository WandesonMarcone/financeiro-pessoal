# Progresso

Atualizado em 28/10/2026. PRs #1 e #2 integrados à `main`; desenvolvimento atual no PR rascunho #3, branch `feat/fase-2-identidade-rls`.

## Implementado nesta branch

- React 19, TypeScript, Vite e PWA responsiva, com login Supabase, verificação de vínculo ativo, perfil próprio, modo simples/completo e limpeza do cache local ao sair.
- Contas, receitas, despesas pessoais/familiares, transferências, categorias, painel, filtros, pesquisa, importação CSV revisável e histórico de auditoria.
- Cartões, limite, compras parceladas, cálculo de vencimentos, faturas, pagamento sem duplicar despesa e estorno protegido.
- Contas a vencer, recorrências, orçamentos, metas/contribuições, patrimônio, lista familiar de compras, produtos/preços e relatórios CSV/XLSX/PDF.
- Notas e documentos privados (JPEG, PNG, WebP e PDF até 10 MB), checksum, retomada de upload, OCR português local, leitura de QR Code, garantia e itens de compra. Nenhuma consulta automática à SEFAZ foi inventada.
- IndexedDB por usuário para cópia offline e fila de lançamentos; UUID/idempotência, erro visível, repetição manual e bloqueio da saída enquanto existirem pendências.
- Exportação JSON e backup AES-256-GCM com PBKDF2, documentos e verificador/descompactador local. A restauração completa no banco continua sendo procedimento administrativo a ensaiar.

## Banco e segurança aplicados

- Supabase Free `ucxgyfxyiahtqdsmkkhi`, ainda sem usuários, famílias ou dados reais.
- Migrações `20261028105717_identity_family_rls`, `20261028161917_finance_modules` e `20261028162109_finance_indexes` aplicadas.
- 21 tabelas públicas com RLS, concessões explícitas, bucket `family-documents` privado e escrita monetária apenas pela RPC atômica/idempotente `post_transaction`.
- Contas e cartões são privados até quando pagam despesa familiar; o outro membro vê a despesa e o pagador, não a origem, saldo ou fatura privada.
- Consulta de verificação confirmou: zero tabelas públicas sem RLS; anônimo sem leitura de transações/documentos e sem execução da RPC; cliente autenticado sem INSERT direto em transações; bucket não público.
- O Security Advisor mantém um aviso conhecido porque a RPC é intencionalmente `SECURITY DEFINER`. Ela revoga `PUBLIC`/`anon`, exige `auth.uid()`, vínculo ativo, dono das contas/cartões, valida payload e registra idempotência. Removê-la quebraria a atomicidade; a decisão deve ser reavaliada em auditoria independente.

## Verificações locais

- 15 testes Vitest: identidade/interface, módulo financeiro, centavos, parcelas, datas, saldos, faturas, normalização e fila offline.
- Testes PostgreSQL temporários aplicam todas as migrações e validam anônimo, não convidado, dois membros, família externa, revogado, privacidade pessoal, despesa familiar, idempotência e bloqueio de escrita direta.
- Build de produção e PWA concluídos; `npm audit --omit=dev` encontrou zero vulnerabilidades. A auditoria completa registra quatro avisos baixos numa ferramenta de build (`deepmerge` via Workbox) sem correção compatível disponível em 28/10/2026.
- Smoke test HTTP local respondeu a aplicação e os arquivos OCR. Nenhum dado financeiro real foi usado.

## Bloqueios para uso real/publicação

1. Desabilitar signup público no painel Supabase (`disable_signup=false` foi observado). O plugin conectado não expõe essa alteração de Auth.
2. Criar exatamente os dois usuários, formar uma família e vincular os IDs; exige os dois endereços de e-mail e um fluxo seguro de definição/recuperação de senha.
3. Testar login e autorização HTTP com as duas contas reais, incluindo revogação, upload/download cruzado e aparelhos Android/iPhone.
4. Ensaiar restauração do backup em ambiente isolado. O verificador local prova senha/integridade, mas não reinsere registros no banco.
5. Conectar Cloudflare Pages ao repositório privado e configurar as duas variáveis públicas após revisão/integração do PR. O site ainda não foi publicado.

Esses itens impedem chamar o sistema de produção concluída, mas o código financeiro não é fictício: os módulos e regras já executam contra o schema aplicado.
