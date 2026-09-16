# Changelog

As notas de cada versão são publicadas automaticamente na release do GitHub
(ver `scripts/release-notes.mjs`). O título de cada secção tem de ser `## vX.Y.Z`,
igual à tag, senão a release sai com as notas por omissão.

## v1.1.13

### Adicionado

- Mostra o histórico de produção de cada receita, com data, lotes e doses produzidas.
- Adiciona a área **Prontos para venda**, com o stock atual de produto acabado.
- Adapta a consulta de produtos prontos e o histórico para ecrãs mobile.

## v1.1.9

### Adicionado

- Adapta a aplicação para utilização em browsers mobile e tablets, com navegação, listas, detalhes, formulários e diálogos responsivos.
- Permite gerar uma lista de compras em ficheiro de texto com os ingredientes em stock baixo.

### Corrigido

- Ajusta o layout mobile para viewports inferiores a 1024 px.
- Corrige o encaixe e o alinhamento dos botões em ecrãs pequenos.

## v1.1.8

### Corrigido

- Impede eliminar pedidos entregues sem repor as doses baixadas no stock.
- Impede eliminações que deixariam ingredientes, receitas ou clientes referenciados por outros registos.
- Remove produções associadas ao apagar dados de exemplo.
- Valida a estrutura e as referências internas dos backups antes da importação.
- Permite configurar o modelo Gemini e identifica modelos indisponíveis.

## v1.1.6

### Corrigido

- **Leitor de código de barras nunca detetava nada no desktop (Windows), sem
  mostrar erro nenhum.** O leitor preferia a `BarcodeDetector` nativa do
  navegador quando disponível; no Chrome/Edge em desktop essa API por vezes
  existe mas não tem suporte real a formatos 1D (EAN/UPC), e ficava a correr
  para sempre sem detetar nada — sem lançar exceção, porque "nada detetado
  neste frame" não é um erro. Passa a usar sempre o descodificador em JS da
  própria lib (`html5-qrcode`), que funciona de forma consistente em
  qualquer sistema operativo.
- Mostra um aviso ao fim de 8 segundos sem deteção, para dar feedback em vez
  de silêncio total enquanto o leitor continua a tentar.

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
