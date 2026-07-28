import Dexie, { type EntityTable } from "dexie";

/**
 * ChefGestão — Local-First database (IndexedDB via Dexie).
 * All data lives on the user's device. No cloud sync in the free tier.
 */

export type UnidadeMedida = "g" | "kg" | "ml" | "l" | "un";

export interface Ingrediente {
  id: number;
  nome: string;
  unidade: UnidadeMedida;
  quantidadeEmbalagem: number;
  precoEmbalagem: number;
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
