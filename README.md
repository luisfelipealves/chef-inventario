# ChefGestão

Aplicação de gestão para cozinheiras e confeiteiras artesanais: stock de
ingredientes, fichas técnicas de receitas com custo de produção, clientes,
pedidos e um painel financeiro — tudo num só sítio.

## Filosofia: os dados são teus

O ChefGestão é **local-first, sem nuvem e sem contas**. 100% dos dados vivem
no dispositivo do utilizador (IndexedDB via Dexie). Não há servidores nossos,
subscrições nem dependências online: compra-se uma vez e a app é de quem a
comprou.

- **Backup automático** diário no arranque (retenção de 60 dias) e backup
  manual por ficheiro JSON (exportar/importar, também para migrar de máquina).
- **Backup na nuvem, à moda antiga**: aponta-se uma pasta sincronizada
  (iCloud Drive, Google Drive, Dropbox…) e o cliente de sincronização trata
  do resto. A app só escreve ficheiros.
- **Leitura de faturas por IA (opcional)**: usa a API do Google Gemini com a
  chave do próprio utilizador (gratuita), guardada só no dispositivo. Sem
  chave, a app funciona a 100% — o registo manual de compras está sempre lá.

## Funcionalidades

- Ingredientes com stock, preço por unidade, código de barras (leitor pela
  câmara) e alerta de stock baixo
- Receitas com rendimento, custo por dose e margem
- Pedidos com estados (pendente/confirmado/entregue/cancelado), mudança de
  estado em um clique e exportação de orçamento/resumo em PDF
- Clientes com contactos e NIF
- Financeiro por período: receita, gastos (histórico de compras), lucro,
  gráficos e exportação CSV para o contabilista
- Onboarding com dados de exemplo removíveis

## Stack

React + TypeScript + Vite · TanStack Router · Dexie (IndexedDB) ·
Tailwind/shadcn + tema próprio "Organic" · Recharts · jsPDF ·
[Tauri](https://tauri.app) para a app desktop (macOS).

## Desenvolvimento

Requisitos: Node.js + npm; para a app desktop, a toolchain do Tauri (Rust).

```sh
npm i
npm run dev        # web, em modo desenvolvimento
npm run tauri dev  # app desktop
npm run build      # build de produção (web)
npm run tauri build# app desktop empacotada
```

`npm run lint` corre o ESLint; `npx tsc --noEmit` verifica os tipos.
