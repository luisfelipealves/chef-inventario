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
  quantidadeEmbalagem: number;
  precoEmbalagem: number;
  /** EAN-13 lido pela câmara (opcional) */
  codigoBarras?: string;
  createdAt: Date;
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
