# Guia de uso do Financeiro Pessoal

Este guia explica o que cada tela faz, em que ordem usar o sistema e o que cada informação altera. O aplicativo é compartilhado por Wandeson e KAMILLY: os dados financeiros cadastrados ficam visíveis para os dois usuários autenticados.

## Começo rápido

1. Entre com seu e-mail e senha.
2. Abra **Categorias** e mantenha ou ajuste as categorias que fazem sentido para a casa.
3. Em **Contas**, cadastre apenas as contas que terão saldo acompanhado.
4. Em **Cartões**, cadastre cada cartão com limite, dia de fechamento e vencimento.
5. Use **Registrar gasto** no topo para uma compra, receita ou pagamento rápido.

O botão **Como funciona** no início de cada tela mostra uma versão curta destas instruções.

## Lançamentos

### Registrar uma compra

1. Toque em **Registrar gasto**.
2. Escreva uma descrição que permita reconhecer a compra, como `Supermercado BH` ou `Sofá`.
3. Informe o valor e a data.
4. Escolha a categoria e a forma de pagamento.
5. Se for crédito, escolha o cartão. Se a compra foi parcelada, marque a opção e informe o número de parcelas.
6. Salve. O sistema inclui cada parcela na fatura correta pelo fechamento do cartão.

Uma compra no cartão é a despesa. O pagamento da fatura apenas baixa a conta usada para pagar; por isso não é uma segunda despesa.

## Contas, cartões e contas a vencer

- **Contas**: o saldo é o saldo inicial mais os lançamentos que realmente movimentaram aquela conta. Transferências não são receitas nem despesas.
- **Cartões**: informe fechamento e vencimento corretamente. Os cartões não guardam número, senha ou CVV.
- **Contas a vencer**: cadastre condomínio, prestação e similares. Em recorrências, o sistema cria as próximas contas a vencer, mas só movimenta saldo quando o pagamento é registrado.

Para uma conta que varia com IPCA, crie a recorrência como referência e ajuste o valor da conta daquele mês antes de pagar.

## Metas, reservas e dinheiro rendendo CDI

Uma meta é uma reserva com valor final e, se desejado, prazo. Ela não transfere dinheiro automaticamente entre contas.

1. Abra **Metas e reservas** e toque em **Adicionar**.
2. Cadastre o objetivo, valor e prazo.
3. Para uma reserva em cofrinho/rendimento, escolha **Dinheiro rendendo CDI**.
4. Informe onde está o dinheiro, o percentual exibido no aplicativo (por exemplo, `120`) e o CDI anual que você quer usar na estimativa.
5. Registre cada **contribuição** (aporte).
6. Ao conferir a instituição financeira, edite a meta e informe o **saldo real** e a data da consulta.

O sistema usa 252 dias úteis como aproximação e não desconta imposto de renda, IOF, feriados, limites promocionais ou mudanças futuras de taxa. Por isso o saldo real informado por você sempre prevalece para acompanhamento. A taxa deve ser atualizada manualmente quando a instituição mudar a oferta.

## Contracheque previsto e descontos futuros

Essa área serve para planejar o líquido antes de receber. Ela não cria receita nem despesa sozinha, evitando duplicidade.

1. Abra **Contracheque** e cadastre o salário bruto e o dia habitual de pagamento.
2. Dentro do cartão do salário, toque em **Adicionar desconto previsto**.
3. Para empréstimo consignado, escolha `Empréstimo consignado`, marque mensal e informe a data final do contrato.
4. Para FUSEx ou consulta médica que será descontada depois, escolha `Consulta/FUSEx`, informe o valor e o mês previsto de desconto. Use `Apenas uma vez`.
5. Para descontos que sempre ocorrem, como contribuição fixa, escolha mensal.
6. Confira os cartões de **bruto**, **descontos do mês** e **líquido previsto**.
7. Quando o contracheque chegar, registre a receita líquida real em Lançamentos e ajuste/arquive previsões que não se confirmaram.

Assim, uma consulta feita hoje pode ser prevista para daqui a dois ou três meses sem aparecer duas vezes como despesa.

## Conferir contracheque, FUSEx e empréstimos automáticos

Use esta rotina para transformar cada contracheque em histórico verificável:

1. Em **Contracheque previsto**, cadastre a fonte do salário, o valor bruto aproximado e o dia de pagamento.
2. Em **Contracheques**, crie um registro para cada pagamento real usando os três totais do documento: receitas, descontos e líquido recebido. Escolha o tipo: salário normal, 13º (adiantamento ou complemento), férias ou ajuste; e informe a data em que o dinheiro caiu.
3. No registro mensal, adicione uma rubrica para cada linha importante. Copie o código e a descrição do documento, por exemplo `NR0001 - SOLDO`, `ND0001 - FUSEx` ou `ND0013 - DESPESA MÉDICA - FUSEx`.
4. Para cada desconto, selecione a categoria correta: saúde/FUSEx, pensão/contribuição militar, imposto ou outro. O relatório anual soma exatamente as rubricas registradas.

O salário bruto em **Meu salário** é só uma referência de planejamento; não altere esse cadastro todo mês e ele não lança dinheiro no sistema. Exemplo: registre a metade do 13º como `13º - adiantamento` no mês em que entrar; registre as férias como `Férias` em janeiro; em fevereiro, registre o contracheque normal com o líquido efetivamente menor. Assim os relatórios refletem o que de fato caiu, sem tentar adivinhar valores futuros.

Para uma cirurgia ou outra despesa médica parcelada:

1. Em **Compromissos e conferências**, crie `Cirurgia da KAMILLY` como `Despesa médica/FUSEx` e informe o valor total que precisa ser acompanhado.
2. Escolha `Vem no contracheque`.
3. Cadastre o valor e a data esperados de cada desconto conhecido.
4. Quando o novo contracheque chegar, registre a rubrica real e vincule-a a esse compromisso.
5. O cartão do compromisso mostra: total conhecido, quanto já apareceu em descontos e quanto ainda falta conferir. Cada cobrança planejada indica se confere, se está pendente ou se houve diferença.

O sistema só consegue afirmar que o valor está correto quando há dois lados para comparar: o valor/orçamento original da cirurgia e os valores efetivamente lançados nos contracheques. Sem o documento da cobrança original, ele pode mostrar quanto foi descontado, mas não pode concluir se o parcelamento inteiro está correto.

Para o empréstimo que sai automaticamente no mesmo dia em que o salário cai:

1. Crie um compromisso do tipo `Empréstimo`.
2. Escolha `Débito automático após cair o salário` - nunca `Vem no contracheque`.
3. Cadastre cada cobrança esperada.
4. Depois de conferir a movimentação bancária, informe o valor e a data realmente debitados. O aplicativo mostrará qualquer diferença.

Além da conferência, registre a saída real como despesa da conta bancária. Dessa forma ela aparece no saldo, nos relatórios anuais e não é confundida com desconto de contracheque.

## Notas fiscais, QR Code e produtos

1. Em **Notas e documentos**, escolha foto ou PDF.
2. Use **Guardar documento** para arquivar o original.
3. Use **Ler texto / OCR** para obter uma sugestão dos itens. Confirme a lista e o total antes de criar produtos ou lançamento.
4. Use **Ler QR Code** apenas para extrair o link e abrir a consulta fiscal oficial no navegador.

O OCR funciona melhor com foto reta, boa luz, texto nítido e cupom inteiro. O aplicativo não tenta burlar CAPTCHA e não presume acesso automático à SEFAZ. Em cupons grandes, confira os itens antes de salvar: o total precisa bater e itens repetidos devem ser mantidos somente quando realmente foram comprados mais de uma vez.

## Produtos e preços

Produtos só devem ser comparados quando têm a mesma unidade e, idealmente, marca/embalagem. Cadastre `kg`, `l` ou `un`; converta gramas e mililitros para kg/l. O histórico mostra preço por unidade para ajudar a perceber onde um produto foi mais barato.

## Orçamentos, patrimônio e relatórios

- **Orçamentos**: defina limite por categoria e mês. O gasto usado vem dos lançamentos daquela categoria.
- **Patrimônio**: registre bens e valor de referência. Para apartamento financiado, use valor estimado do bem e registre a dívida/parcelas separadamente em contas a vencer; não trate o financiamento como patrimônio quitado.
- **Relatórios**: use o filtro de mês, gráficos e exportação CSV/Excel/PDF. Exporte também uma cópia JSON pelo menu de sincronização.

## Segurança e exclusão

Somente usuários autenticados e membros da família acessam os dados. A exclusão de documento pede a senha atual e remove o arquivo definitivamente. Arquivar um registro preserva o histórico e é preferível a apagar.

Mantenha o bloqueio de tela do celular ativado. Nunca cadastre senha, CVV, número completo de cartão ou chaves secretas no sistema.
