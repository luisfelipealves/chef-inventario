import { useSyncExternalStore } from "react";
import { db, type UnidadeMedida } from "@/lib/db";
import { idiomaAtual } from "@/lib/i18n";

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

/** Escolhe o texto conforme o idioma ativo do onboarding. */
function n(pt: string, en: string): string {
  return idiomaAtual() === "en" ? en : pt;
}

export async function criarDadosExemplo(): Promise<void> {
  // Ingredientes: [nome, unidade, quantidade em stock, preço da embalagem, criado há N dias]
  const ING: [string, UnidadeMedida, number, number, number][] = [
    [n("Farinha de trigo", "Wheat flour"), "kg", 5, 4.5, 28],
    [n("Açúcar", "Sugar"), "kg", 3, 3.3, 28],
    [n("Manteiga", "Butter"), "g", 750, 5.6, 25],
    [n("Ovos", "Eggs"), "un", 30, 6.9, 21],
    [n("Chocolate 70%", "70% chocolate"), "g", 600, 7.8, 21],
    [n("Natas", "Cream"), "ml", 1000, 2.4, 14],
    [n("Leite condensado", "Condensed milk"), "g", 790, 2.95, 14],
    [n("Fermento em pó", "Baking powder"), "g", 150, 1.8, 25],
  ];
  const ingIds = (await db.ingredientes.bulkAdd(
    ING.map(([nome, unidade, qtd, preco, ha]) => ({
      nome,
      unidade,
      quantidadeEmbalagem: qtd,
      precoEmbalagem: preco,
      stock: qtd,
      createdAt: diasAtras(ha),
    })),
    { allKeys: true },
  )) as number[];
  const ing = (nome: string) => ingIds[ING.findIndex(([nm]) => nm === nome)];

  const receitaIds = (await db.receitas.bulkAdd(
    [
      {
        nome: n("Bolo de chocolate", "Chocolate cake"),
        rendimento: 12,
        unidadeRendimento: "un" as UnidadeMedida,
        precoVenda: 3.5,
        ingredientes: [
          { ingredienteId: ing(n("Farinha de trigo", "Wheat flour")), quantidade: 0.25 },
          { ingredienteId: ing(n("Açúcar", "Sugar")), quantidade: 0.2 },
          { ingredienteId: ing(n("Manteiga", "Butter")), quantidade: 200 },
          { ingredienteId: ing(n("Ovos", "Eggs")), quantidade: 4 },
          { ingredienteId: ing(n("Chocolate 70%", "70% chocolate")), quantidade: 200 },
          { ingredienteId: ing(n("Fermento em pó", "Baking powder")), quantidade: 10 },
        ],
        createdAt: diasAtras(20),
      },
      {
        nome: n("Brigadeiros", "Chocolate truffles"),
        rendimento: 30,
        unidadeRendimento: "un" as UnidadeMedida,
        precoVenda: 1.2,
        ingredientes: [
          { ingredienteId: ing(n("Leite condensado", "Condensed milk")), quantidade: 395 },
          { ingredienteId: ing(n("Chocolate 70%", "70% chocolate")), quantidade: 150 },
          { ingredienteId: ing(n("Manteiga", "Butter")), quantidade: 30 },
        ],
        createdAt: diasAtras(18),
      },
      {
        nome: n("Pão de ló", "Sponge cake"),
        rendimento: 10,
        unidadeRendimento: "un" as UnidadeMedida,
        precoVenda: 2.5,
        ingredientes: [
          { ingredienteId: ing(n("Ovos", "Eggs")), quantidade: 6 },
          { ingredienteId: ing(n("Açúcar", "Sugar")), quantidade: 0.25 },
          { ingredienteId: ing(n("Farinha de trigo", "Wheat flour")), quantidade: 0.25 },
        ],
        createdAt: diasAtras(15),
      },
      {
        nome: n("Bolo de bolacha", "Icebox cake"),
        rendimento: 10,
        unidadeRendimento: "un" as UnidadeMedida,
        precoVenda: 2.8,
        ingredientes: [
          { ingredienteId: ing(n("Natas", "Cream")), quantidade: 400 },
          { ingredienteId: ing(n("Manteiga", "Butter")), quantidade: 250 },
          { ingredienteId: ing(n("Açúcar", "Sugar")), quantidade: 0.15 },
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
        nome: n("Maria Silva", "Emma Johnson"),
        telefone: "912 345 678",
        endereco: n("Rua das Flores 12, Lisboa", "12 Flower St, Springfield"),
        nif: "234567890",
        createdAt: diasAtras(25),
      },
      {
        nome: n("João Ferreira", "James Miller"),
        telefone: "936 222 111",
        endereco: n("Av. da Liberdade 45, Porto", "45 Liberty Ave, Riverside"),
        nif: "187654321",
        createdAt: diasAtras(20),
      },
      {
        nome: n("Café Central", "Corner Café"),
        telefone: "213 456 789",
        endereco: n("Praça do Comércio 3, Lisboa", "3 Market Square, Springfield"),
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
        notas: n(
          "Festa de aniversário — escrever 'Parabéns Rita' no bolo.",
          "Birthday party — write 'Happy Birthday Rita' on the cake.",
        ),
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
        notas: n("Entrega semanal.", "Weekly delivery."),
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
        notas: n("Confirmar sabor dos brigadeiros.", "Confirm the truffle flavour."),
        createdAt: diasAtras(1),
      },
      {
        clienteId: cafeCentral,
        itens: [{ receitaId: paoDeLo, quantidade: 20, precoUnitario: 2.5 }],
        dataEntrega: dataISO(diasAtras(1)),
        estado: "cancelado" as const,
        notas: n("Cancelado pelo cliente.", "Cancelled by the customer."),
        createdAt: diasAtras(6),
      },
    ],
    { allKeys: true },
  )) as number[];

  // Compras espalhadas pelas últimas semanas, para o Financeiro ter histórico.
  const COMPRAS: [string, number, number, number][] = [
    [n("Farinha de trigo", "Wheat flour"), 5, 4.5, 20],
    [n("Açúcar", "Sugar"), 3, 3.3, 20],
    [n("Ovos", "Eggs"), 30, 6.9, 15],
    [n("Chocolate 70%", "70% chocolate"), 600, 7.8, 12],
    [n("Manteiga", "Butter"), 750, 5.6, 8],
    [n("Leite condensado", "Condensed milk"), 790, 2.95, 5],
    [n("Natas", "Cream"), 1000, 2.4, 2],
  ];
  const compraIds = (await db.compras.bulkAdd(
    COMPRAS.map(([nome, quantidade, valor, ha]) => {
      const idx = ING.findIndex(([nm]) => nm === nome);
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
      [db.ingredientes, db.receitas, db.clientes, db.pedidos, db.compras, db.producoes],
      async () => {
        // Produções não têm um marcador próprio: removemos as que apontam
        // para receitas de exemplo, incluindo produções feitas pelo utilizador
        // antes de apagar os dados de onboarding.
        const producaoIds = await db.producoes.where("receitaId").anyOf(ids.receitas).primaryKeys();
        await Promise.all([
          db.ingredientes.bulkDelete(ids.ingredientes),
          db.receitas.bulkDelete(ids.receitas),
          db.clientes.bulkDelete(ids.clientes),
          db.pedidos.bulkDelete(ids.pedidos),
          db.compras.bulkDelete(ids.compras ?? []),
          db.producoes.bulkDelete(producaoIds),
        ]);
      },
    );
  }
  localStorage.removeItem(DEMO_KEY);
  notificar();
}
