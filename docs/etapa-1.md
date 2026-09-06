# Etapa 1 — integridade operacional

Compras (`src/lib/operacional.ts`) e produção/pedidos (`src/lib/producao.ts`) concentram as gravações em transações Dexie. Os formulários chamam estes serviços. As transações de entrega incluem a produção automática: qualquer falha reverte ingredientes, doses, produção e pedido.

## Decisões

- Quantidades e rendimento devem ser finitos e positivos; lotes inteiros. Preços finitos e não negativos (zero permite oferta). Referências inexistentes bloqueiam gravações.
- Compra converte kg/g e l/ml para a unidade do ingrediente; unidades de dimensões diferentes exigem revisão humana da quantidade e unidade da embalagem. Nunca se presume peso por unidade.
- Linhas repetidas leem o estoque atualizado dentro da transação. A última linha define a embalagem/preço de referência, preservando a política existente.
- Uma revisão OCR recebe um identificador: confirmar novamente essa mesma revisão não duplica compras, inclusive concorrentemente. Reabrir/importar novamente o arquivo cria uma nova operação. Não há identificação fiscal nem deduplicação entre sessões/documentos.
- Estoque insuficiente bloqueia produção/entrega integralmente. Não há baixa truncada a zero, produção parcial ou entrega sem doses suficientes. O usuário deve repor a despensa/produzir primeiro.
- Entrega relê o pedido no banco e é idempotente. Cada entrega nova guarda as doses baixadas e um movimento datado no próprio pedido.
- Sair de entregue repõe exatamente essas doses e registra a reversão. Não desfaz a produção nem devolve ingredientes, pois os produtos já foram preparados. Pedido cancelado deve ser reaberto antes da entrega pelo seletor.
- Edição de pedido entregue é bloqueada até reversão pelo seletor, inclusive alterações de notas. Criação/edição com estado entregue grava pedido e baixa conjuntamente.

## Compatibilidade e limites

Sem nova versão de schema: campos opcionais não indexados em Compra/Pedido são suportados pelo IndexedDB atual. Nenhuma migração altera estoques ou presume baixas de entregas antigas. Entregas legadas continuam idempotentes, mas sua reversão automática é bloqueada; requerem conferência manual fora deste fluxo. O fallback `stockDe` para registros antigos permanece.

Os movimentos no pedido são rastreabilidade local, não um livro de auditoria imutável; exclusão do pedido e restauração de backups continuam com seu comportamento anterior. Não houve expansão do formato de backup, custos históricos ou pagamentos. As mensagens novas de validação dos serviços estão em português; os textos de orientação de produção foram atualizados em português e inglês.

## Verificação

Testes Vitest usam `fake-indexeddb`, sem abrir dados reais do navegador/Tauri. Cobrem conversões, dimensões incompatíveis, repetição de linhas/importação, concorrência, falha de gravação de compra, produção/entrega, reversão/reentrega, legado, edição entregue, criação/edição atômicas, referências inválidas, estoque insuficiente e valores não finitos. Executar `bun run typecheck`, `bun run test`, `bun run lint`, `bun run build`.

Build verificado do frontend Vite; não foi gerado instalador nativo nem executado teste manual em janela Tauri. Nenhuma release foi publicada.
