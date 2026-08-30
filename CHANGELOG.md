# Changelog

As notas de cada versão são publicadas automaticamente na release do GitHub
(ver `scripts/release-notes.mjs`). O título de cada secção tem de ser `## vX.Y.Z`,
igual à tag, senão a release sai com as notas por omissão.

## v1.1.5

### Corrigido

- **O custo das receitas deixa de ser corrompido ao registar produções.** O stock
  da despensa passou a ter campo próprio (`stock`), separado dos dados da
  embalagem que servem de base ao custo unitário. Até aqui as produções abatiam
  em `quantidadeEmbalagem` sem mexer no preço, o que inflacionava o custo de cada
  ingrediente a cada produção e, com a despensa a zero, punha o custo da receita
  a 0 € (margem aparentemente infinita). Como o Financeiro recalcula os custos a
  partir dos preços atuais, o histórico de lucro também mudava retroativamente.
- A migração da base de dados é automática (`db.version(7)`) e **não perde
  dados**: o valor que estava em `quantidadeEmbalagem` era, de facto, o stock, e
  é o que passa para o campo novo. Backups exportados em versões anteriores
  continuam a ser lidos corretamente.
- O stock passa a ser corrigível à mão no formulário de edição do ingrediente.

### Interno

- O CI passa a correr tipos, lint e testes **antes** de empacotar, num job
  próprio que barra o build. Também corre em pushes e PRs, e não só em tags.
- Testes de backup deixam de depender do idioma do sistema — comparavam com
  texto em português e falhavam em qualquer máquina sem locale pt.
- Dependências pinadas: `bun.lock` regenerado (faltavam-lhe `i18next`,
  `react-i18next`, `vitest`, `jspdf` e os plugins Tauri, que eram resolvidos de
  novo a cada build) e `package-lock.json` removido, que divergia do primeiro.
  `prettier` fixado na versão exata, por a formatação mudar entre minors.
