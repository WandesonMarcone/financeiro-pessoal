# Testes

`npm test` executa os testes de interface, domínio e fila offline com Vitest. `npm run test:db` cria um PostgreSQL temporário no processo com PGlite, aplica todas as migrações e executa `identity_rls.sql` e `finance_rls.sql`.

Os cenários usam somente UUIDs e valores fictícios. Eles cobrem centavos, arredondamento de parcelas, datas, transferências neutras, pagamento de fatura sem duplicar despesa, idempotência, escrita monetária atômica, isolamento pessoal, compartilhamento familiar, usuário de outra família e revogação. Nenhum teste deve apontar para o banco que contém dados reais.

