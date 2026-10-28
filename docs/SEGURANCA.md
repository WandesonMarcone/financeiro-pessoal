# Segurança e privacidade

Estado: controles planejados; nenhuma política implantada ou auditada.

## Fronteiras
Dois logins individuais e uma família. Convites fechados; sessão expira e é renovada pelo provedor. RLS ativa em cada tabela exposta e política de Storage privado. Testes por usuário A, B, anônimo e membro externo; SELECT e INSERT/UPDATE/DELETE, incluindo troca de household_id, owner_user_id, joins, funções, views e anexos. UI simplificada nunca amplia permissões.

Despesa familiar guarda referência ao pagador, mas não expõe saldo, número ou nome privado da conta/cartão dele. Agregações e relatórios executam sob contexto do usuário; auditoria herda escopo do registro. Documentos em bucket privado com caminhos não previsíveis, validação de MIME, tamanho e permissões de upload/download/delete; URLs assinadas curtas quando necessárias. Sanitizar OCR/nomes de arquivo, não confiar em QR ou dados importados. Segredos apenas no ambiente seguro do provedor; chave pública pode estar no cliente, service_role jamais.

## Dados locais e resiliência
HTTPS, CSP e dependências verificadas; limpar cache financeiro ao sair/trocar usuário; explicar risco em aparelho compartilhado. Fila offline idempotente com integridade, retry limitado e estado visível. Chaves de operação não autorizam ação por si. Backups fora do Supabase com dump do banco **e** objetos, criptografados, inventário de checksums, calendário e ensaio de restauração. Free não oferece backup automático baixável; não colocar dados financeiros reais antes de procedimento de backup/restauração testado.

## Limite da promessa de privacidade
Papel de administrador dentro da aplicação não dará acesso automático ao privado da esposa. Operador com privilégio de infraestrutura (proprietário do projeto, banco e chaves elevadas) pode tecnicamente acessar dados. Garantir sigilo até frente ao operador exigiria criptografia ponta a ponta com chaves que ele não controla; abrir decisão separada antes de prometer isso. Não registrar dados reais em testes ou logs.
