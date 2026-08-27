import Dexie, { type EntityTable } from "dexie";

/**
 * Caderninho de Receitas — base de dados local-first (IndexedDB via Dexie).
 * Os dados vivem todos no dispositivo do utilizador — sem nuvem, sem contas.
 */

export type UnidadeMedida = "g" | "kg" | "ml" | "l" | "un";

export interface Ingrediente {
  id: number;
  nome: string;
  unidade: UnidadeMedida;
  /**
   * Tamanho da embalagem de referência. Junto com `precoEmbalagem` forma a
   * base do custo unitário — nunca é alterado por produções ou entregas.
   */
  quantidadeEmbalagem: number;
  /** Preço pago pela embalagem de referência. */
  precoEmbalagem: number;
  /**
   * Quantidade em despensa, na unidade do ingrediente. Sobe com as compras e
   * desce com as produções. Ausente em dados anteriores à v7 — ler sempre
   * através de `stockDe()`, que cai para `quantidadeEmbalagem`.
   */
  stock?: number;
  /** EAN-13 lido pela câmara (opcional) */
  codigoBarras?: string;
  createdAt: Date;
}

/**
 * Stock em despensa, tolerante a registos anteriores à v7 (e a backups
 * antigos, que a migração do Dexie não toca).
 */
export function stockDe(ing: Pick<Ingrediente, "stock" | "quantidadeEmbalagem">): number {
  return ing.stock ?? ing.quantidadeEmbalagem;
}

export interface IngredienteReceita {
  ingredienteId: number;
  quantidade: number;
}

export interface Receita {
  id: number;
  nome: string;
  rendimento: number;
  unidadeRendimento: UnidadeMedida;
  ingredientes: IngredienteReceita[];
  precoVenda?: number;
  /** Doses produzidas e ainda não vendidas (stock de produto acabado). */
  dosesProntas?: number;
  createdAt: Date;
}

/**
 * Registo de uma produção ("fiz N lotes desta receita").
 * Ao registar, os ingredientes baixam na despensa e as doses prontas sobem.
 */
export interface Producao {
  id: number;
  /** Pode apontar para uma receita entretanto removida. */
  receitaId: number;
  /** Nome da receita no momento da produção. */
  nome: string;
  /** Nº de vezes que a receita foi feita. */
  lotes: number;
  /** Doses produzidas = lotes × rendimento no momento. */
  doses: number;
  createdAt: Date;
}

export interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  endereco: string;
  nif: string;
  createdAt: Date;
}

/**
 * Registo histórico de uma compra de ingrediente (para o Financeiro).
 * Criado ao "Adicionar compra" e ao importar faturas; nunca é editado.
 */
export interface Compra {
  id: number;
  /** Pode apontar para um ingrediente entretanto removido. */
  ingredienteId?: number;
  /** Nome do ingrediente no momento da compra. */
  nome: string;
  quantidade: number;
  unidade: UnidadeMedida;
  /** Valor pago (€). */
  valor: number;
  createdAt: Date;
}

export type EstadoPedido = "pendente" | "confirmado" | "entregue" | "cancelado";

export interface ItemPedido {
  receitaId: number;
  /** Nº de doses/unidades encomendadas */
  quantidade: number;
  /** Preço de venda por dose/unidade (€) */
  precoUnitario: number;
}

export interface Pedido {
  id: number;
  clienteId: number;
  itens: ItemPedido[];
  dataEntrega: string;
  estado: EstadoPedido;
  notas: string;
  createdAt: Date;
}

export const db = new Dexie("ChefGestaoDB") as Dexie & {
  ingredientes: EntityTable<Ingrediente, "id">;
  receitas: EntityTable<Receita, "id">;
  clientes: EntityTable<Cliente, "id">;
  pedidos: EntityTable<Pedido, "id">;
  compras: EntityTable<Compra, "id">;
  producoes: EntityTable<Producao, "id">;
};

db.version(1).stores({
  ingredientes: "++id, nome, createdAt",
  receitas: "++id, nome, createdAt",
});

db.version(2).stores({
  ingredientes: "++id, nome, createdAt",
  receitas: "++id, nome, createdAt",
  clientes: "++id, nome, telefone, nif, createdAt",
});

db.version(3).stores({
  ingredientes: "++id, nome, createdAt",
  receitas: "++id, nome, createdAt",
  clientes: "++id, nome, telefone, nif, createdAt",
  pedidos: "++id, clienteId, dataEntrega, estado, createdAt",
});

db.version(4).stores({
  ingredientes: "++id, nome, codigoBarras, createdAt",
  receitas: "++id, nome, createdAt",
  clientes: "++id, nome, telefone, nif, createdAt",
  pedidos: "++id, clienteId, dataEntrega, estado, createdAt",
});

db.version(5).stores({
  ingredientes: "++id, nome, codigoBarras, createdAt",
  receitas: "++id, nome, createdAt",
  clientes: "++id, nome, telefone, nif, createdAt",
  pedidos: "++id, clienteId, dataEntrega, estado, createdAt",
  compras: "++id, ingredienteId, createdAt",
});

db.version(6).stores({
  ingredientes: "++id, nome, codigoBarras, createdAt",
  receitas: "++id, nome, createdAt",
  clientes: "++id, nome, telefone, nif, createdAt",
  pedidos: "++id, clienteId, dataEntrega, estado, createdAt",
  compras: "++id, ingredienteId, createdAt",
  producoes: "++id, receitaId, createdAt",
});

/**
 * v7 — separa o stock da despensa dos dados da embalagem.
 *
 * Até à v6 `quantidadeEmbalagem` acumulava os dois papéis: divisor do custo
 * unitário e stock disponível. Como as produções abatiam nesse campo sem
 * mexer em `precoEmbalagem`, o custo por unidade subia a cada produção e caía
 * a zero quando a despensa esvaziava. O stock passa a viver em `stock`; os
 * dados existentes herdam o valor que lá estava, que era de facto o stock.
 */
db.version(7)
  .stores({
    ingredientes: "++id, nome, codigoBarras, createdAt",
    receitas: "++id, nome, createdAt",
    clientes: "++id, nome, telefone, nif, createdAt",
    pedidos: "++id, clienteId, dataEntrega, estado, createdAt",
    compras: "++id, ingredienteId, createdAt",
    producoes: "++id, receitaId, createdAt",
  })
  .upgrade((tx) =>
    tx
      .table<Ingrediente>("ingredientes")
      .toCollection()
      .modify((ing) => {
        ing.stock ??= ing.quantidadeEmbalagem;
      }),
  );
