# Desenvolvimento

Base executável em React, TypeScript e Vite. Node 24, npm.

1. npm ci
2. Copiar .env.example para .env.local e preencher URL e chave publishable do Supabase.
3. npm run dev
4. `npm test`, `npm run test:db`, `npm audit --omit=dev` e `npm run build`

Guia completo: [Publicação](PUBLICACAO_CLOUDFLARE.md). Estado atual: [Progresso](PROGRESSO.md). O README original foi preservado.

Estrutura: `src` para aplicação, `tests` para interface e SQL, `supabase/migrations` para schema, `public` para PWA/cabeçalhos e `docs` para decisões. O `postinstall` copia para `public/tesseract` os arquivos OCR fixados no lockfile; essa pasta gerada não é versionada. Nunca versionar `.env.local`, dados pessoais, `service_role` ou senhas. Não executar fixtures SQL em banco com dados reais.
