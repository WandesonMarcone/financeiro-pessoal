# Progresso

Atualizado em 28/10/2026. PRs #1 a #5 integrados à `main`; PR6 em revisão na branch `feat/onboarding-inicial`. O repositório foi renomeado para `WandesonMarcone/financeiro-pessoal`.

## Implementado nesta branch

- React 19, TypeScript, Vite e PWA responsiva, com login Supabase, verificação de vínculo ativo, perfil próprio, modo simples/completo e limpeza do cache local ao sair.
- Contas, receitas, despesas pessoais/familiares, transferências, categorias, painel, filtros, pesquisa, importação CSV revisável e histórico de auditoria.
- Cartões, limite, compras parceladas, cálculo de vencimentos, faturas, pagamento sem duplicar despesa e estorno protegido.
- Contas a vencer, recorrências, orçamentos, metas/contribuições, patrimônio, lista familiar de compras, produtos/preços e relatórios CSV/XLSX/PDF.
- Notas e documentos privados (JPEG, PNG, WebP e PDF até 10 MB), checksum, retomada de upload, OCR português local, leitura de QR Code, garantia e itens de compra. Nenhuma consulta automática à SEFAZ foi inventada.
- IndexedDB por usuário para cópia offline e fila de lançamentos; UUID/idempotência, erro visível, repetição manual e bloqueio da saída enquanto existirem pendências.
- Exportação JSON e backup AES-256-GCM com PBKDF2, documentos e verificador/descompactador local. A restauração completa no banco continua sendo procedimento administrativo a ensaiar.
- Guia mobile-first de primeiros passos, criação opcional de categorias familiares padrão e atalhos para configurar conta, cartão e primeiro lançamento. Nenhum saldo ou valor financeiro é inventado.
- Próximo PR: sugestões locais de linhas de produtos a partir do texto OCR, com correção individual, seleção e confirmação antes de salvar no documento. Formatos de nota variam; linhas incertas ficam para cadastro manual. A consulta pública da SEF/MG exige reCAPTCHA e não é importação automática.

## Banco e segurança aplicados

- Supabase Free `ucxgyfxyiahtqdsmkkhi`, com dois usuários Auth e uma família `Nossa Casa` provisionados; sem contas, lançamentos ou documentos financeiros reais.
- Migrações `20261028105717_identity_family_rls`, `20261028161917_finance_modules` e `20261028162109_finance_indexes` aplicadas.
- 21 tabelas públicas com RLS, concessões explícitas, bucket `family-documents` privado e escrita monetária apenas pela RPC atômica/idempotente `post_transaction`.
- Contas e cartões são privados até quando pagam despesa familiar; o outro membro vê a despesa e o pagador, não a origem, saldo ou fatura privada.
- Consulta de verificação confirmou: zero tabelas públicas sem RLS; anônimo sem leitura de transações/documentos e sem execução da RPC; cliente autenticado sem INSERT direto em transações; bucket não público.
- O Security Advisor mantém um aviso conhecido porque a RPC é intencionalmente `SECURITY DEFINER`. Ela revoga `PUBLIC`/`anon`, exige `auth.uid()`, vínculo ativo, dono das contas/cartões, valida payload e registra idempotência. Removê-la quebraria a atomicidade; a decisão deve ser reavaliada em auditoria independente.

## Verificações locais

- 19 testes Vitest: identidade/interface, recuperação de senha, módulo financeiro, centavos, parcelas, datas, saldos, faturas, normalização, fila offline e configuração inicial.
- Testes PostgreSQL temporários aplicam todas as migrações e validam anônimo, não convidado, dois membros, família externa, revogado, privacidade pessoal, despesa familiar, idempotência e bloqueio de escrita direta.
- Build de produção e PWA concluídos; `npm audit --omit=dev` encontrou zero vulnerabilidades. O caminho do GitHub Pages foi atualizado para `/financeiro-pessoal/` após a renomeação do repositório. A auditoria completa registra quatro avisos baixos numa ferramenta de build (`deepmerge` via Workbox) sem correção compatível disponível em 28/10/2026.
- Smoke test HTTP local respondeu a aplicação e os arquivos OCR. Nenhum dado financeiro real foi usado.

## Bloqueios para uso real/publicação

1. Ativar a proteção contra senhas vazadas no painel Supabase; o Security Advisor sinaliza essa configuração como pendente.
2. Testar login e autorização HTTP com as duas contas reais, incluindo revogação, upload/download cruzado e aparelhos Android/iPhone.
3. Ensaiar restauração do backup em ambiente isolado. O verificador local prova senha/integridade, mas não reinsere registros no banco.
4. Atualizar no Supabase Auth a URL de redirecionamento para `https://wandesonmarcone.github.io/financeiro-pessoal/` e confirmar o novo endereço do GitHub Pages após a integração do PR6.

Esses itens impedem chamar o sistema de produção concluída, mas o código financeiro não é fictício: os módulos e regras já executam contra o schema aplicado.
# Compra com várias páginas de cupom

- Preparada a estrutura de uma compra formada por até 50 fotos, preservando cada imagem e sua ordem.
- A confirmação automática só ocorre quando a soma dos itens confere com o total pago, ou com subtotal menos desconto.
- Sobreposições entre fotos só são eliminadas quando o número fiscal do item e os valores coincidem; produtos parecidos não são apagados por engano.
- O usuário pode escolher um estabelecimento conhecido (Assaí, Supermercado BH e Supermercados Leal) ou informar outro nome. O texto OCR é apenas sugestão.

