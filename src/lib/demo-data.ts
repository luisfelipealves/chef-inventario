import { useSyncExternalStore } from "react";
import { db, type UnidadeMedida } from "@/lib/db";

/**
 * Dados de exemplo para o onboarding. Os IDs criados ficam registados em
 * localStorage para o botão "Apagar dados de exemplo" (Definições) os poder
 * remover sem tocar em dados criados pelo utilizador.
 */

const DEMO_KEY = "chefgestao:demo-ids";

interface DemoIds {
  ingredientes: number[];
  receitas: number[];
  clientes: number[];
  pedidos: number[];
  compras: number[];
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notificar() {
  listeners.forEach((l) => l());
}

function lerIds(): DemoIds | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(DEMO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DemoIds;
  } catch {
    return null;
  }
}

export function useTemDadosExemplo(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => typeof localStorage !== "undefined" && localStorage.getItem(DEMO_KEY) !== null,
    () => false,
  );
}

function diasAtras(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/** Data local em "YYYY-MM-DD" (formato de Pedido.dataEntrega). */
function dataISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

export async function criarDadosExemplo(): Promise<void> {
  // Ingredientes: [nome, unidade, quantidade em stock, preço da embalagem, criado há N dias]
  const ING: [string, UnidadeMedida, number, number, number][] = [
    ["Farinha de trigo", "kg", 5, 4.5, 28],
    ["Açúcar", "kg", 3, 3.3, 28],
    ["Manteiga", "g", 750, 5.6, 25],
    ["Ovos", "un", 30, 6.9, 21],
    ["Chocolate 70%", "g", 600, 7.8, 21],
    ["Natas", "ml", 1000, 2.4, 14],
    ["Leite condensado", "g", 790, 2.95, 14],
    ["Fermento em pó", "g", 150, 1.8, 25],
  ];
  const ingIds = (await db.ingredientes.bulkAdd(
    ING.map(([nome, unidade, qtd, preco, ha]) => ({
      nome,
      unidade,
      quantidadeEmbalagem: qtd,
      precoEmbalagem: preco,
      createdAt: diasAtras(ha),
    })),
    { allKeys: true },
  )) as number[];
  const ing = (nome: string) => ingIds[ING.findIndex(([n]) => n === nome)];

  const receitaIds = (await db.receitas.bulkAdd(
    [
      {
        nome: "Bolo de chocolate",
        rendimento: 12,
        unidadeRendimento: "un" as UnidadeMedida,
        precoVenda: 3.5,
        ingredientes: [
          { ingredienteId: ing("Farinha de trigo"), quantidade: 0.25 },
          { ingredienteId: ing("Açúcar"), quantidade: 0.2 },
          { ingredienteId: ing("Manteiga"), quantidade: 200 },
          { ingredienteId: ing("Ovos"), quantidade: 4 },
          { ingredienteId: ing("Chocolate 70%"), quantidade: 200 },
          { ingredienteId: ing("Fermento em pó"), quantidade: 10 },
        ],
        createdAt: diasAtras(20),
      },
      {
        nome: "Brigadeiros",
        rendimento: 30,
        unidadeRendimento: "un" as UnidadeMedida,
        precoVenda: 1.2,
        ingredientes: [
          { ingredienteId: ing("Leite condensado"), quantidade: 395 },
          { ingredienteId: ing("Chocolate 70%"), quantidade: 150 },
          { ingredienteId: ing("Manteiga"), quantidade: 30 },
        ],
        createdAt: diasAtras(18),
      },
      {
        nome: "Pão de ló",
        rendimento: 10,
        unidadeRendimento: "un" as UnidadeMedida,
        precoVenda: 2.5,
        ingredientes: [
          { ingredienteId: ing("Ovos"), quantidade: 6 },
          { ingredienteId: ing("Açúcar"), quantidade: 0.25 },
          { ingredienteId: ing("Farinha de trigo"), quantidade: 0.25 },
        ],
        createdAt: diasAtras(15),
      },
      {
        nome: "Bolo de bolacha",
        rendimento: 10,
        unidadeRendimento: "un" as UnidadeMedida,
        precoVenda: 2.8,
        ingredientes: [
          { ingredienteId: ing("Natas"), quantidade: 400 },
          { ingredienteId: ing("Manteiga"), quantidade: 250 },
          { ingredienteId: ing("Açúcar"), quantidade: 0.15 },
        ],
        createdAt: diasAtras(12),
      },
    ],
    { allKeys: true },
  )) as number[];
  const [boloChoc, brigadeiros, paoDeLo, boloBolacha] = receitaIds;

  const clienteIds = (await db.clientes.bulkAdd(
    [
      {
        nome: "Maria Silva",
        telefone: "912 345 678",
        endereco: "Rua das Flores 12, Lisboa",
        nif: "234567890",
        createdAt: diasAtras(25),
      },
      {
        nome: "João Ferreira",
        telefone: "936 222 111",
        endereco: "Av. da Liberdade 45, Porto",
        nif: "187654321",
        createdAt: diasAtras(20),
      },
      {
        nome: "Café Central",
        telefone: "213 456 789",
        endereco: "Praça do Comércio 3, Lisboa",
        nif: "509876543",
        createdAt: diasAtras(15),
      },
    ],
    { allKeys: true },
  )) as number[];
  const [maria, joao, cafeCentral] = clienteIds;

  const pedidoIds = (await db.pedidos.bulkAdd(
    [
      {
        clienteId: maria,
        itens: [{ receitaId: boloChoc, quantidade: 12, precoUnitario: 3.5 }],
        dataEntrega: dataISO(diasAtras(7)),
        estado: "entregue" as const,
        notas: "Festa de aniversário — escrever 'Parabéns Rita' no bolo.",
        createdAt: diasAtras(12),
      },
      {
        clienteId: cafeCentral,
        itens: [
          { receitaId: brigadeiros, quantidade: 60, precoUnitario: 1.2 },
          { receitaId: paoDeLo, quantidade: 10, precoUnitario: 2.5 },
        ],
        dataEntrega: dataISO(diasAtras(3)),
        estado: "entregue" as const,
        notas: "Entrega semanal.",
        createdAt: diasAtras(8),
      },
      {
        clienteId: joao,
        itens: [{ receitaId: boloBolacha, quantidade: 10, precoUnitario: 2.8 }],
        dataEntrega: dataISO(diasAtras(-2)),
        estado: "confirmado" as const,
        notas: "",
        createdAt: diasAtras(2),
      },
      {
        clienteId: maria,
        itens: [
          { receitaId: boloChoc, quantidade: 12, precoUnitario: 3.5 },
          { receitaId: brigadeiros, quantidade: 30, precoUnitario: 1.2 },
        ],
        dataEntrega: dataISO(diasAtras(-5)),
        estado: "pendente" as const,
        notas: "Confirmar sabor dos brigadeiros.",
        createdAt: diasAtras(1),
      },
      {
        clienteId: cafeCentral,
        itens: [{ receitaId: paoDeLo, quantidade: 20, precoUnitario: 2.5 }],
        dataEntrega: dataISO(diasAtras(1)),
        estado: "cancelado" as const,
        notas: "Cancelado pelo cliente.",
        createdAt: diasAtras(6),
      },
    ],
    { allKeys: true },
  )) as number[];

  // Compras espalhadas pelas últimas semanas, para o Financeiro ter histórico.
  const COMPRAS: [string, number, number, number][] = [
    ["Farinha de trigo", 5, 4.5, 20],
    ["Açúcar", 3, 3.3, 20],
    ["Ovos", 30, 6.9, 15],
    ["Chocolate 70%", 600, 7.8, 12],
    ["Manteiga", 750, 5.6, 8],
    ["Leite condensado", 790, 2.95, 5],
    ["Natas", 1000, 2.4, 2],
  ];
  const compraIds = (await db.compras.bulkAdd(
    COMPRAS.map(([nome, quantidade, valor, ha]) => {
      const idx = ING.findIndex(([n]) => n === nome);
      return {
        ingredienteId: ingIds[idx],
        nome,
        quantidade,
        unidade: ING[idx][1],
        valor,
        createdAt: diasAtras(ha),
      };
    }),
    { allKeys: true },
  )) as number[];

  const ids: DemoIds = {
    ingredientes: ingIds,
    receitas: receitaIds,
    clientes: clienteIds,
    pedidos: pedidoIds,
    compras: compraIds,
  };
  localStorage.setItem(DEMO_KEY, JSON.stringify(ids));
  notificar();
}

export async function apagarDadosExemplo(): Promise<void> {
  const ids = lerIds();
  if (ids) {
    await db.transaction(
      "rw",
      [db.ingredientes, db.receitas, db.clientes, db.pedidos, db.compras],
      async () => {
        await Promise.all([
          db.ingredientes.bulkDelete(ids.ingredientes),
          db.receitas.bulkDelete(ids.receitas),
          db.clientes.bulkDelete(ids.clientes),
          db.pedidos.bulkDelete(ids.pedidos),
          db.compras.bulkDelete(ids.compras ?? []),
        ]);
      },
    );
  }
  localStorage.removeItem(DEMO_KEY);
  notificar();
}
