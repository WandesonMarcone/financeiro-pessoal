# Execução e publicação da base
Estado: aplicação financeira/PWA funcional no PR #3; publicação e criação dos dois usuários ainda pendentes.

## Local
Node 24 (arquivo .nvmrc), npm. Executar `npm ci`, copiar .env.example para .env.local e preencher URL Supabase e chave **publishable**. Executar `npm run dev`. Validar com `npm test` e `npm run build`.
O arquivo .env.local é ignorado. Nunca usar service_role ou chave secreta em VITE_*.

## Cloudflare Pages — quando o PR estiver integrado
Conectar somente o repositório privado WandesonMarcone/nossa-casa-financas.
- Branch de produção: main.
- Diretório raiz: raiz do repositório.
- Build: npm run build.
- Saída: dist.
- Node: 24 (NODE_VERSION=24).
- Variáveis: VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.
- Previews: usar projeto de teste separado ou desabilitar deploys automáticos de branches; nunca apontar previews não revisados para dados reais.
- HTTPS fornecido pela plataforma; domínio próprio opcional.
O frontend usa CSS próprio e é uma PWA instalável. O shell e os recursos estáticos funcionam offline; snapshots e fila são separados por usuário no IndexedDB. OCR, fotos/PDF, QR e exportações já estão implementados. O modelo OCR é copiado no `postinstall` e armazenado pelo service worker somente quando usado.

## Acesso
O cliente usa Supabase Auth (email/senha), valida o usuário no servidor e exige exatamente um vínculo ativo. Não há cadastro público na interface. **Isso não desabilita cadastro no provedor:** conferir o toggle de signup em Auth antes de publicar. Login por convite/redefinição de senha ainda precisa de implementação e configuração de redirects/SMTP.
Sessão mantida em `sessionStorage` por aba. Dados privados podem ficar no IndexedDB para consulta offline, sempre identificados pelo usuário/família; sair limpa esses dados. A saída é bloqueada se houver lançamento pendente para evitar perda. Foco/retorno da rede e verificações periódicas revalidam acesso; RLS protege cada requisição mesmo antes da atualização visual.
O perfil salva apenas o nome do usuário atual. Não há painéis financeiros simulados.

## Validação e limites
Vitest verifica login, acesso negado, módulo financeiro, fila offline e regras de domínio. Os testes PostgreSQL temporários aplicam todas as migrações e cobrem identidade/RLS e operações financeiras. São camadas diferentes; ainda falta autenticação HTTP ponta a ponta com as duas contas, convite/recuperação, restauração completa e validação em Android/iPhone.

