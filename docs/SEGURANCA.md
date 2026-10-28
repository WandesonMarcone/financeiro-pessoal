# Segurança e privacidade

Estado: controles de banco e Storage implantados no Supabase de desenvolvimento; auditoria independente e testes com contas reais ainda pendentes.

## Fronteiras
Decisão do proprietário: toda informação financeira é exclusiva de usuários autorizados. Dois logins individuais e uma família. Convites fechados, sem registro público; sessão expira e é renovada pelo provedor. Visitante, anônimo, conta não convidada, membro revogado e usuário de outra família recebem negação por padrão em todas as rotas de dados, objetos, buscas, agregações e exportações. A página estática de entrada pode ser pública, sem qualquer dado privado. RLS ativa em cada tabela exposta e política de Storage privado. Testes por usuário A, B, anônimo, conta autenticada não convidada, membro revogado e membro externo; SELECT e INSERT/UPDATE/DELETE, incluindo troca de household_id, owner_user_id, joins, funções, views e anexos. UI simplificada nunca amplia permissões.

Despesa familiar guarda referência ao pagador, mas não expõe saldo, número ou nome privado da conta/cartão dele. Agregações e relatórios executam sob contexto do usuário; auditoria herda escopo do registro. Documentos em bucket privado com caminhos não previsíveis, validação de MIME, tamanho e permissões de upload/download/delete; URLs assinadas curtas quando necessárias. Sanitizar OCR/nomes de arquivo, não confiar em QR ou dados importados. Segredos apenas no ambiente seguro do provedor; chave pública pode estar no cliente, service_role jamais.

## Controles implantados

As 21 tabelas públicas têm RLS e concessões explícitas. Anônimo não recebe leitura de tabelas financeiras nem execução da RPC. `post_transaction` é o único caminho de escrita monetária do cliente e valida `auth.uid()`, vínculo, dono, limites, datas, payload e idempotência antes de escrever razão, parcelas e faturas atomicamente. O bucket `family-documents` é privado e cada objeto depende dos metadados autorizados em `documents`.

O Supabase Security Advisor sinaliza essa RPC por ser `SECURITY DEFINER` executável por `authenticated`. O uso é intencional para impedir escrita parcial: `PUBLIC` e `anon` foram revogados, todos os identificadores são revalidados dentro da função e o `search_path` é vazio. O aviso permanece documentado para revisão externa antes da produção. Referência: [advisor 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Dados locais e resiliência
HTTPS, CSP, PWA e dependências verificadas; a CSP limita origens ao site e Supabase e permite workers locais para PDF/OCR. OCR português é servido com o site, sem enviar a imagem a API externa. Ao sair, snapshot, fila e preferências do usuário são apagados; se houver pendência, a saída é bloqueada até sincronizar, exportar ou descartar. Fila offline idempotente com erro visível; chaves de operação não autorizam ação por si.

O aplicativo produz backup `.ncb` com dados e objetos, PBKDF2 (250 mil iterações), AES-256-GCM e verificador/descompactador local. Isso não substitui dump administrativo nem ensaio de reinserção. Free não oferece backup automático baixável; não colocar dados financeiros reais antes de restauração completa testada em ambiente isolado.

## Limite da promessa de privacidade
Papel de administrador dentro da aplicação não dará acesso automático ao privado da esposa. Operador com privilégio de infraestrutura (proprietário do projeto, banco e chaves elevadas) pode tecnicamente acessar dados. Garantir sigilo até frente ao operador exigiria criptografia ponta a ponta com chaves que ele não controla; abrir decisão separada antes de prometer isso. Não registrar dados reais em testes ou logs.

