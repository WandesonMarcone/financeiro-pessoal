# Execução e publicação da base
Estado: frontend inicial funcional para contas já provisionadas; publicação e criação dos dois usuários ainda pendentes.

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
O frontend inicial usa CSS próprio, sem dependência Tailwind nesta etapa. PWA instalável, cache offline, fotos e exportações serão implementados nas fases correspondentes.

## Acesso
O cliente usa Supabase Auth (email/senha), valida o usuário no servidor e exige exatamente um vínculo ativo. Não há cadastro público na interface. **Isso não desabilita cadastro no provedor:** conferir o toggle de signup em Auth antes de publicar. Login por convite/redefinição de senha ainda precisa de implementação e configuração de redirects/SMTP.
Sessão mantida em sessionStorage por aba; dados privados não são armazenados em cache offline. Mudança de autenticação limpa a área interna; foco/retorno da rede e verificações a cada 60 segundos revalidam acesso. RLS continua protegendo cada requisição, mesmo antes da atualização visual.
O perfil salva apenas o nome do usuário atual. Não há painéis financeiros simulados.

## Validação e limites
Testes React com gateway simulado verificam fluxo, erros, acesso negado, sessão atrasada e revogação antes de salvar. SQL em tests/identity_rls.sql testa autorização real com fixtures revertidas. São camadas diferentes; testes da interface não provam autenticação end-to-end. Executar em desenvolvimento, sem dados reais. Falta teste HTTP autenticado com contas de teste, convite, recuperação, backup/restauração e validação em Android/iPhone.

