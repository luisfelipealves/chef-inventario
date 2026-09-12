# Fase 1 — confiança nos cálculos

- `Receita.precoVenda` continua a representar a receita completa. Não há migração nem alteração dos valores guardados. O preço por unidade é dividido pelo rendimento, sem arredondamento prematuro na criação de pedidos.
- Fichas, formulário, painel e pedidos partilham as fórmulas: resultado = venda − ingredientes; margem = resultado / venda; acréscimo = resultado / ingredientes.
- Preço zero explícito é válido; preço ausente, ingrediente removido, quantidade inválida ou rendimento inválido não são interpretados como custo zero.
- Custos desconhecidos usam `NaN` apenas nos cálculos em memória, apresentado como `—`. As percentagens indefinidas usam `null`. Os formulários validam números antes de guardar; estes resultados não são persistidos.
- Um custo incompleto invalida o resultado agregado dos pedidos e do financeiro, preservando os valores conhecidos de venda. As receitas incompletas não entram na classificação de margens.
- O preço sugerido sem preço de venda definido (custo × 3) foi removido. É necessário indicar um preço; zero explícito continua permitido.
- Textos em português e inglês esclarecem que embalagens de venda, trabalho, energia e outras despesas ainda não são calculados. Preservação dos custos históricos pertence à fase 5.

## Caso de aceitação

Ingredientes 10 €, rendimento 10 unidades, venda da receita completa 20 €: ingredientes por unidade 1 €, venda por unidade 2 €, resultado 10 €, margem sobre a venda 50%, acréscimo sobre o custo 100%. Pedidos de uma unidade ou de vários lotes mantêm as mesmas percentagens.

## Branch

A branch local `feature/epic/codex` foi renomeada para `feature/epic/codex/fase-1`; a base continua preservada em `origin/feature/epic/codex`. O Git não permite publicar ambos os nomes no mesmo remoto: antes de um futuro push será necessário escolher um nome compatível ou reorganizar as branches remotas. Nenhuma branch remota foi alterada nesta fase.
