# Plano de implementação — ecrãs mobile/celular

## Objetivo

Adaptar a aplicação Caderninho de Receitas para telemóveis em orientação vertical e horizontal, mantendo o comportamento desktop existente e reaproveitando os serviços, componentes de domínio e dados atuais. O resultado deve ser utilizável com toque, sem scroll horizontal involuntário, com conteúdo legível em larguras de 320 px a 767 px e com formulários que não fiquem escondidos pelo teclado virtual.

Este documento é um plano de execução. Cada tarefa abaixo é deliberadamente pequena: pode ser copiada como uma instrução independente para o Codex. A ordem indicada reduz retrabalho e mantém cada alteração verificável.

## Contexto técnico encontrado

- O shell está em `src/lib/shell.tsx`, `src/components/shell/AppShell.tsx`, `Sidebar.tsx` e `Topbar.tsx`.
- `src/styles.css` define `.shell-root { min-width: 1180px; }` e `#root { overflow-x: auto; }`; isso permite uma página desktop comprimida/rolável, mas não uma experiência mobile real.
- Existe `src/hooks/use-mobile.tsx` com breakpoint de 768 px, porém o hook é usado pelos componentes Radix de sidebar e não pela navegação própria da aplicação.
- As páginas de ingredientes, receitas, pedidos e clientes usam `.lista-view` com painel de tabela e `.detalhe-panel` de 392 px.
- O dashboard (`src/routes/index.tsx`) e o financeiro (`src/routes/financeiro.tsx`) têm grids inline de quatro colunas e grids de duas colunas.
- Os formulários principais já usam `Sheet`/`Dialog` com largura `w-full` e limite `sm:max-w`, mas ainda precisam de ajustes de viewport, espaçamento, teclado e campos em colunas.
- Os fluxos de stock, compras, produção, pedidos, backup e OCR estão em serviços separados; o trabalho mobile deve alterar apresentação e interação, sem copiar ou reimplementar essas regras.

## Decisões de produto a manter

- Em mobile, uma lista e o respetivo detalhe não ficam lado a lado. A lista ocupa a rota; o detalhe abre como uma folha/página de detalhe.
- A navegação principal fica acessível por botão de menu e folha lateral ou inferior. Não se deve manter a sidebar desktop ocupando largura mínima.
- Ações primárias continuam visíveis e fáceis de tocar; ações destrutivas permanecem protegidas por confirmação.
- Tabelas densas viram cartões/linhas empilhadas quando a informação puder ser apresentada sem perda. Só usar scroll horizontal para dados genuinamente tabulares que não tenham alternativa clara.
- O desktop deve continuar com a mesma arquitetura visual e não deve perder a seleção persistente da aplicação.
- A acessibilidade é requisito funcional: foco, nomes acessíveis, ordem de leitura, contraste, tamanho de toque e navegação por teclado devem ser testados.

## Regras de execução para todas as tarefas

- Antes de editar, ler o ficheiro indicado e preservar alterações existentes.
- Preferir classes CSS reutilizáveis a estilos inline repetidos.
- Não alterar serviços de Dexie ou regras de cálculo numa tarefa puramente visual.
- Em cada tarefa, executar pelo menos o teste ou verificação indicado e confirmar que o working tree contém apenas a alteração esperada.
- Validar sempre em 320×568, 360×800, 390×844, 430×932 e 768×1024; usar 1024×768 e 1440×900 como regressão desktop.

## Tarefas copiáveis

### M01 — inventariar o contrato visual atual

**Instrução para o Codex:**

> Leia `src/styles.css`, `src/lib/shell.tsx`, `src/components/shell/AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `GlobalSearch.tsx` e todas as rotas em `src/routes`. Liste as dimensões mínimas, larguras fixas, grids inline, tabelas, sheets e diálogos que podem causar overflow abaixo de 768 px. Não faça alterações. Entregue um inventário com ficheiro, linha aproximada, impacto mobile e proposta de classe/abstração a usar depois.

**Validação:** confirmar que o inventário cobre shell, dashboard, quatro listas, financeiro, formulários e diálogos.

### M02 — definir tokens e breakpoints mobile

**Instrução para o Codex:**

> Em `src/styles.css`, adicione tokens CSS para breakpoint mobile, gutter horizontal mobile, altura mínima de alvo de toque, raio de cartões e espaçamento vertical de secções. Use nomes semânticos e valores compatíveis com o sistema visual existente. Não altere ainda os componentes. Documente no próprio CSS o intervalo de cada breakpoint.

**Validação:** `bun run typecheck`, `bun run lint` e inspeção visual de que nenhum estilo desktop mudou.

### M03 — remover a restrição estrutural de largura mínima

**Instrução para o Codex:**

> Ajuste o shell em `src/styles.css` para permitir viewport de 320 px: remova ou substitua a dependência de `min-width: 1180px` em `.shell-root`, elimine scroll horizontal global de `#root` e preserve `min-width: 0` nos descendentes flexíveis. Adicione proteção contra overflow de texto, tabelas e gráficos sem esconder conteúdo de forma silenciosa. Não implemente ainda a navegação mobile.

**Validação:** abrir a aplicação em 320 px e confirmar que a página não ganha scrollbar horizontal; verificar desktop em 1440 px.

### M04 — criar contrato de viewport e hook responsivo

**Instrução para o Codex:**

> Reveja `src/hooks/use-mobile.tsx`. Transforme-o num hook estável para renderização client-side, com breakpoint alinhado aos tokens CSS e subscrição correta a `matchMedia`. Exponha, se necessário, `useIsMobile` e um estado de hidratação que não cause layout errado no primeiro render. Não duplique listeners em cada componente.

**Validação:** adicionar teste do hook para viewport mobile/desktop e executar a suíte Vitest.

### M05 — adaptar o AppShell para dois modos de navegação

**Instrução para o Codex:**

> Em `src/components/shell/AppShell.tsx` e `src/lib/shell.tsx`, defina o contrato entre shell desktop e mobile: desktop conserva sidebar persistente; mobile renderiza conteúdo sem a sidebar ocupando espaço e fornece estado `mobileNavOpen`. Garanta que abrir/fechar navegação não altera rota, filtro ou seleção. Evite ler `window` durante SSR/hidratação.

**Validação:** teste de montagem ou teste manual: alternar largura não perde rota nem seleção.

### M06 — criar trigger e folha de navegação mobile

**Instrução para o Codex:**

> Adapte `Sidebar.tsx` para mobile usando o componente `Sheet` existente. Crie um botão de menu com `aria-label`, foco visível e alvo mínimo de 44 px. Reutilize `NAV`, contagens, alerta de stock, definições e ação de recolher quando fizer sentido; ao navegar, feche a folha. A sidebar desktop deve manter o comportamento atual.

**Validação:** testar abrir, navegar para cada rota, fechar com X, Escape, clique no overlay e voltar do browser.

### M07 — adaptar o Topbar e a pesquisa global

**Instrução para o Codex:**

> Adapte `Topbar.tsx` e `GlobalSearch.tsx` para mobile. Organize o título, botão de menu, pesquisa e ação primária sem sobreposição; em larguras pequenas, permita que a pesquisa ocupe uma segunda linha ou abra uma folha dedicada. Garanta que resultados da pesquisa não ficam cortados pelo viewport e que selecionar um resultado fecha a pesquisa/navegação corretamente.

**Validação:** testar títulos longos, nome de utilizador longo, teclado virtual, resultados com nomes longos e ação `Novo` em 320 px.

### M08 — definir o padrão de detalhe mobile

**Instrução para o Codex:**

> Crie um padrão reutilizável para detalhe de item em mobile: cabeçalho com botão voltar, título, estado e ações; corpo rolável; ações destrutivas no fim. Pode ser um componente em `src/components/lista` ou uma folha configurável. O padrão deve permitir que a rota mostre lista ou detalhe, sem duplicar o conteúdo de cada detalhe.

**Validação:** demonstrar o padrão com um mock simples e confirmar foco inicial no título/botão voltar.

### M09 — adaptar `.lista-view`, painel e seleção

**Instrução para o Codex:**

> Atualize as classes partilhadas de listas em `src/styles.css`: desktop continua em duas colunas; abaixo de 768 px, `.lista-view` vira uma coluna, o painel de detalhe não aparece simultaneamente e a seleção deve abrir o padrão de detalhe mobile. Preserve estados `data-selected`, filtros e scroll vertical interno onde forem necessários.

**Validação:** testar lista vazia, carregamento, um item, muitos itens e retorno do detalhe para a mesma posição da lista.

### M10 — criar apresentação mobile para linhas de tabela

**Instrução para o Codex:**

> Crie classes/componentes para converter as tabelas das listas em cartões ou linhas responsivas. Cada item deve manter o nome principal, os indicadores essenciais, estado e ação de seleção; dados secundários podem ficar numa segunda linha. Não remova dados necessários: disponibilize-os no detalhe. Não use `display:none` em informação sem decidir onde ela reaparece.

**Validação:** verificar leitura sem zoom e ausência de overflow em 320 px; testar nomes e valores longos.

### M11 — adaptar a barra de filtros (`FiltroBar`)

**Instrução para o Codex:**

> Adapte `src/components/lista/FiltroBar.tsx` para mobile. Permita filtros em scroll horizontal controlado ou menu compacto, mantenha contagem legível e reserve uma linha própria para a ação primária. A barra deve ter alvos de toque mínimos e não empurrar o conteúdo para fora da viewport.

**Validação:** testar as quatro listas com todos os filtros e com traduções pt-PT/en.

### M12 — adaptar a rota de ingredientes

**Instrução para o Codex:**

> Adapte `src/routes/ingredientes.tsx` ao padrão mobile: cartão de ingrediente com nome, stock, unidade, alerta e preço; detalhe mobile com ações editar, comprar, ler fatura e remover; manter filtros e seleção. Reaproveite `IngredienteFormDialog`, `FaturaSheet` e regras de stock existentes. Não altere cálculos.

**Validação:** testar stock baixo, ingrediente sem código de barras, ingrediente removido/referenciado, lista vazia e retorno após guardar compra.

### M13 — adaptar o formulário de ingrediente

**Instrução para o Codex:**

> Ajuste `IngredienteFormDialog.tsx` para mobile: padding menor, cabeçalho fixo quando necessário, corpo rolável, footer acessível acima do teclado e campos em uma coluna abaixo de 480 px. Garanta que o campo de stock e validações continuam acessíveis no modo edição e que o scanner não perde o foco.

**Validação:** criar, editar e adicionar compra em 320 px; testar teclado numérico, erro de validação e cancelamento.

### M14 — adaptar leitura de fatura e scanner

**Instrução para o Codex:**

> Ajuste `FaturaSheet.tsx` e `BarcodeScannerDialog.tsx` para ecrãs pequenos: área de câmara proporcional, controlos grandes, upload acessível, revisão de linhas sem colunas comprimidas e footer fixo/rolável. Preserve permissões de câmara, encerramento e mensagens de erro. Não altere OCR nem conversões.

**Validação:** testar sem câmara, com permissão recusada, upload, linha longa, remoção de linha e confirmação com teclado aberto.

### M15 — adaptar a rota de receitas

**Instrução para o Codex:**

> Adapte `src/routes/receitas.tsx` para cartões mobile com nome, rendimento, custo por dose, preço e margem. Mova ingredientes, indicadores, produção e ações para o detalhe mobile. Preserve os filtros `todas`, `rentaveis` e `falhas`, incluindo a indicação de custo incompleto.

**Validação:** testar receita sem ingredientes, ingrediente removido, margem negativa, receita rentável e produção.

### M16 — adaptar formulário e produção de receita

**Instrução para o Codex:**

> Ajuste `ReceitaFormDialog.tsx` e `ProducaoDialog.tsx` para mobile. Transforme a edição de ingredientes numa lista empilhada com controlos de quantidade e remoção fáceis de tocar; mantenha rendimento, preço e validações. No diálogo de produção, garanta que a prévia de consumo e stock não fica cortada e que o botão de confirmação permanece alcançável.

**Validação:** criar/editar receita com vários ingredientes, erro de rendimento, stock insuficiente e produção bem-sucedida.

### M17 — adaptar a rota de pedidos

**Instrução para o Codex:**

> Adapte `src/routes/pedidos.tsx` para cartões com cliente, data, total, estado e resumo de itens. No detalhe mobile, mantenha edição, PDF, estado e remoção protegida. Faça o estado clicável ter alvo de toque mínimo e não depender de hover.

**Validação:** testar cada estado do pedido, filtro, cliente removido, receita removida, exportação PDF e remoção protegida.

### M18 — adaptar formulário e estado de pedido

**Instrução para o Codex:**

> Ajuste `PedidoFormDialog.tsx` e `EstadoSelect.tsx` para mobile. Empilhe cliente, data, estado e linhas de receita; mantenha resumo de custo/venda/margem; garanta que o menu de estado e o alerta de doses insuficientes cabem acima do teclado. Não altere `guardarPedido`, `entregarPedido` ou regras de stock.

**Validação:** criar pedido, editar pedido, entrega com produção automática, erro por falta de stock, reabertura e tentativa concorrente.

### M19 — adaptar a rota de clientes

**Instrução para o Codex:**

> Adapte `src/routes/clientes.tsx` para cartões mobile com nome, contacto, pedidos abertos e total. No detalhe, empilhe contacto, morada, NIF e histórico. Mantenha navegação para pedidos e bloqueio de remoção quando houver dependências.

**Validação:** testar telefone/morada longos, cliente sem pedidos, cliente com pedidos, filtro de abertos e remoção bloqueada.

### M20 — adaptar formulário de cliente

**Instrução para o Codex:**

> Ajuste `ClienteFormDialog.tsx` para uma coluna em mobile, com labels associados, teclado adequado por campo, footer alcançável e mensagens de validação próximas do campo. Preserve limite de texto e estado de submissão.

**Validação:** criar e editar cliente em 320 px e testar teclado, rotação e cancelamento.

### M21 — adaptar dashboard inicial

**Instrução para o Codex:**

> Adapte `src/routes/index.tsx`: transforme o grid de quatro indicadores numa coluna ou carrossel acessível; empilhe os blocos de próximas entregas e stock baixo; preserve navegação para pedidos/ingredientes. Evite gráficos ou cartões com largura fixa. Mantenha dados demo e estados vazios.

**Validação:** testar dashboard vazio, com dados demo, com nomes longos e em orientação vertical/horizontal.

### M22 — adaptar financeiro

**Instrução para o Codex:**

> Adapte `src/routes/financeiro.tsx`: indicadores em cartões empilhados, filtros de período em linhas que caibam, gráfico com altura responsiva e largura mínima segura, estados/compras em listas e exportação CSV acessível. Preserve cálculos e ordenação. Se um gráfico exigir scroll, limite-o ao cartão e documente o motivo.

**Validação:** testar cada período, intervalo personalizado, sem movimentos, muitas compras, valores negativos/zero e exportação.

### M23 — adaptar Definições e onboarding

**Instrução para o Codex:**

> Ajuste `DefinicoesSheet.tsx` e `PrimeiroArranqueDialog.tsx` para mobile: folha quase em ecrã inteiro, secções empilhadas, botões de backup e remoção de demo com alvos grandes, textos longos quebráveis e confirmação destrutiva visível. Preserve importação/exportação e estados de erro.

**Validação:** testar primeiro arranque, backup manual, importação inválida, pasta adicional Tauri e remoção de dados demo.

### M24 — garantir comportamento de teclado virtual e safe areas

**Instrução para o Codex:**

> Reverta todos os sheets/dialogs e o shell para suportar `100dvh`, `env(safe-area-inset-top)` e `env(safe-area-inset-bottom)`. Footer de formulários deve continuar visível quando o teclado aparece; conteúdo deve poder rolar para o campo focado. Não fixe elementos de forma que cubram mensagens de erro.

**Validação:** testar iOS Safari, Android Chrome ou simuladores equivalentes, teclado aberto, orientação horizontal e notch/safe area.

### M25 — normalizar alvos de toque e foco

**Instrução para o Codex:**

> Audite botões, links, ícones, linhas selecionáveis, estados e controlos de tabela. Crie classes partilhadas para alvo mínimo de 44×44 px, espaçamento entre ações e foco visível. Substitua dependências de hover por estados de toque/foco. Não aumente indiscriminadamente elementos decorativos.

**Validação:** inspeção manual com navegação por teclado e teste de toque sem cliques acidentais entre ações adjacentes.

### M26 — corrigir overflow tipográfico e internacionalização

**Instrução para o Codex:**

> Audite pt-PT e en em todos os ecrãs mobile. Corrija títulos, badges, mensagens, nomes, moradas, URLs, preços e datas que possam estourar a largura. Use quebra de palavras ou truncamento apenas quando o detalhe mantiver o texto completo. Não traduza strings nesta tarefa; apenas torne o layout resiliente.

**Validação:** alternar idioma em 320 px e verificar cada rota, sheet, alerta e estado.

### M27 — adicionar testes de componentes para shell mobile

**Instrução para o Codex:**

> Crie testes focados para navegação mobile, Topbar, padrão de detalhe, FiltroBar e estados de lista. Teste abertura/fecho, acessibilidade básica, seleção, retorno e ação primária. Use mocks mínimos de Dexie/datasets; não replique testes de serviços já existentes.

**Validação:** `bun run test` e relatório dos cenários cobertos.

### M28 — criar matriz de testes manuais por fluxo

**Instrução para o Codex:**

> Crie `docs/mobile-test-matrix.md` com uma matriz por viewport, orientação, navegador e fluxo: onboarding, dashboard, ingredientes, OCR, scanner, receitas, produção, pedidos, entrega/reversão, clientes, financeiro, backup, idioma e tema. Cada célula deve ter pré-condições, passos, resultado esperado e severidade.

**Validação:** garantir que cada tarefa M12–M26 aparece na matriz.

### M29 — executar auditoria visual e acessível

**Instrução para o Codex:**

> Execute a matriz mobile em dados demo e dados vazios. Registe screenshots dos casos com maior risco, problemas de foco, overflow, scroll preso, conteúdo coberto pelo teclado, contraste ou alvo pequeno. Corrija apenas regressões introduzidas pelo trabalho mobile e associe cada correção à tarefa correspondente.

**Validação:** checklist aprovado em 320, 390, 430 e 768 px; desktop sem regressões.

### M30 — verificar desempenho e bundle

**Instrução para o Codex:**

> Faça uma verificação de desempenho em mobile: tempo até conteúdo inicial, troca de rota, abertura de sheets e carregamento de OCR/scanner sob demanda. Não faça otimizações de produto nesta tarefa; apenas identifique regressões causadas pelo layout e registre o tamanho dos chunks relevantes.

**Validação:** `bun run build`, comparação dos tamanhos de `dist/assets` e teste em throttling de rede/CPU.

### M31 — revisão final de regressão desktop

**Instrução para o Codex:**

> Faça uma revisão exclusiva de desktop em 1024×768, 1280×820 e 1440×900. Confirme sidebar, topbar, tabelas, painel de detalhe, grids financeiros, folhas, diálogos, filtros e ações. Corrija regressões sem desfazer o comportamento mobile.

**Validação:** screenshots comparativos ou checklist assinado por rota.

### M32 — fechar documentação e critérios de aceitação

**Instrução para o Codex:**

> Atualize `README.md` ou documentação apropriada com o suporte mobile, breakpoints adotados, limitações conhecidas e comandos de verificação. Registre critérios de aceitação: sem overflow horizontal em 320 px, navegação acessível, todos os fluxos críticos utilizáveis com toque, desktop preservado e testes/build passando.

**Validação:** `bun run test`, `bun run typecheck`, `bun run lint` e `bun run build`; working tree contém apenas alterações relacionadas ao plano mobile. O layout mobile aplica-se a viewports inferiores a 1024 px, incluindo tablets e emulações comuns do Chrome.

## Ordem recomendada de execução

1. M01–M04: contrato e fundação responsiva.
2. M05–M11: shell, navegação, detalhe, listas e filtros.
3. M12–M20: ingredientes, receitas, pedidos e clientes.
4. M21–M23: dashboard, financeiro, definições e onboarding.
5. M24–M26: teclado, toque, foco e internacionalização.
6. M27–M30: testes, matriz, auditoria e desempenho.
7. M31–M32: regressão desktop, documentação e aceite.

## Critérios de conclusão

- Nenhuma rota apresenta scroll horizontal global em 320 px.
- Sidebar desktop não reduz a área mobile nem força largura mínima.
- Todas as entidades de lista têm apresentação utilizável, detalhe acessível e retorno previsível.
- Formulários e diálogos podem ser usados com teclado virtual aberto.
- Ações primárias e destrutivas continuam identificáveis e têm alvo de toque adequado.
- Stock, produção, entrega, reversão, backup, OCR, exportações e cálculos continuam usando os serviços existentes.
- pt-PT e en não introduzem overflow.
- Testes, typecheck, lint e build passam; os avisos já existentes do lint ficam documentados.
- A release mobile só deve ser considerada após a matriz manual e a regressão desktop serem aprovadas.
