# Nossa Casa — especificação do projeto

Estado: especificação inicial (28/10/2026). Requisitos abaixo são metas, não funcionalidades implementadas.

## Objetivo e princípios
PWA privado e responsivo para duas pessoas de uma família, com sincronização entre celular e computador e operação essencial offline. Cada pessoa tem login próprio; interface simples para quem só quer lançar um gasto e interface completa para administração. Complexidade visual não altera privilégios. Nenhuma informação financeira, documento, metadado, relatório ou resposta de API pode ser consultada por visitantes, contas não autenticadas, usuários não convidados, membros removidos ou pessoas fora da família. Apenas os dois usuários autorizados têm acesso, cada um segundo o escopo pessoal ou familiar. Dinheiro pessoal é privado por padrão; despesas familiares são compartilhadas. A administração técnica não implica permissão de leitura de dados pessoais do outro membro. Sem mensalidade ou API paga obrigatória. Dados e documentos devem ser exportáveis.

## Regras financeiras
- Valor monetário em centavos inteiros ou NUMERIC(18,2) no banco, nunca float para somas; moeda BRL inicialmente; datas locais em America/Sao_Paulo, instantes persistidos em UTC.
- Uma despesa tem descrição, valor, data, categoria, estabelecimento opcional, pagador, origem (conta/cartão), escopo pessoal ou familiar e anexos opcionais. Escopo pessoal exige proprietário; escopo familiar exige participação na família.
- O pagador de despesa familiar pode variar; totais por pagador são informativos. Nunca gerar dívida ou cobrança sem ação explícita.
- Transferência entre contas é um par vinculado de movimentos patrimoniais; não aumenta receitas/despesas. Estorno conserva trilha de auditoria.
- Compra no cartão gera obrigação e competência de despesa uma vez; parcelas são compromissos futuros; pagamento da fatura liquida passivo e reduz conta, sem nova despesa. Definir a visão de caixa e competência separadamente.
- Todo lançamento aceita identificador único por dispositivo e chave de idempotência, com validação de duplicatas na importação. Correções criam revisão auditável.
- Documentos têm metadados, escopo e proprietário; reconhecimento OCR é sugestão editável, nunca dado confirmado automaticamente.

## Módulos e prioridade
1. Identidade, família, regras de acesso e testes de autorização.
2. Contas, receitas, despesas, categorias, histórico, transferências e painel básico.
3. Despesas familiares, pagador, interface rápida e lista compartilhada.
4. Cartões, faturas, parcelas, recorrências e conciliação.
5. Orçamento, reservas, metas e patrimônio.
6. Notas fiscais prioritárias, imagem/PDF/QR, OCR local ou gratuito, revisão humana, anexos e garantias. Consulta NFC-e somente após estudo de disponibilidade e regras do estado.
7. Compras: itens, quantidades, marcas, lojas, unidades normalizadas e preço comparável por unidade.
8. Fila offline, sincronização, deduplicação, conflitos e alertas.
9. Relatórios mensais/anuais, filtros, gráficos, CSV/XLSX/PDF, testes e publicação.

## Experiência
Fluxo rápido: registrar valor, descrição e escopo familiar em poucos passos; campos adicionais opcionais e defaults explícitos. Acesso fácil a foto/upload de nota, despesas familiares e lista de compras. O perfil completo tem navegação administrativa. Cada recurso exibido precisa corresponder a operação real e autorizada.

## Critérios transversais
Teste com duas identidades, dados pessoais cruzados e família alheia; logs sem valores sensíveis; nenhum segredo no Git. Offline essencial: criar, consultar cache autorizado e editar rascunhos/despesas básicas; documento grande e OCR podem exigir conexão. Sincronização mostra pendências e erros sem perder o lançamento local. Exportação inclui dados estruturados e anexos com manifestos de integridade.

## Definições pendentes
- Escolher método de login e recuperação de conta sem depender do SMTP gratuito limitado; cadastro fechado para dois convites, sem inscrição pública.
- Definir quem pode alterar/excluir lançamentos familiares e quem vê totais agregados privados; recomendação: autor edita, ambos veem os familiares, nenhum vê agregado privado do outro.
- Definir conta/cartão pessoal usado em despesa familiar: recomendação mostrar pagador, tipo e identificação pública opcional, nunca detalhes/saldo da origem.
- Definir regra de conflito em edição simultânea, retenção de documentos, limite de upload e política de exclusão/exportação.
- Escolher formato de competência para parcelas, orçamento e recorrências; confirmar necessidade de múltiplas moedas e de acertos/reembolsos.
- Confirmar plataforma de hospedagem e operação de backup antes de configurar contas de serviço.
