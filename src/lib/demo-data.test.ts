import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import { apagarDadosExemplo, criarDadosExemplo } from "./demo-data";
import i18n from "./i18n";

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
});

beforeEach(async () => {
  await db.delete();
  await db.open();
  storage.clear();
});

afterAll(() => db.delete());

describe("apagarDadosExemplo", () => {
  it("remove produções ligadas às receitas de exemplo", async () => {
    await db.receitas.bulkAdd([
      {
        id: 1,
        nome: "Demo",
        rendimento: 1,
        unidadeRendimento: "un",
        ingredientes: [],
        createdAt: new Date(),
      },
      {
        id: 2,
        nome: "Utilizador",
        rendimento: 1,
        unidadeRendimento: "un",
        ingredientes: [],
        createdAt: new Date(),
      },
    ]);
    await db.producoes.bulkAdd([
      { id: 1, receitaId: 1, nome: "Demo", lotes: 1, doses: 1, createdAt: new Date() },
      { id: 2, receitaId: 2, nome: "Utilizador", lotes: 1, doses: 1, createdAt: new Date() },
    ]);
    storage.set(
      "chefgestao:demo-ids",
      JSON.stringify({
        ingredientes: [],
        receitas: [1],
        clientes: [],
        pedidos: [],
        compras: [],
      }),
    );

    await apagarDadosExemplo();

    expect(await db.producoes.toArray()).toHaveLength(1);
    expect((await db.producoes.get(2))?.receitaId).toBe(2);
    expect(await db.receitas.get(1)).toBeUndefined();
    expect(storage.get("chefgestao:demo-ids")).toBeUndefined();
  });
});

describe("criarDadosExemplo", () => {
  it("cria um conjunto coerente de onboarding e regista todos os ids", async () => {
    await criarDadosExemplo();

    expect(await db.ingredientes.count()).toBe(8);
    expect(await db.receitas.count()).toBe(4);
    expect(await db.clientes.count()).toBe(3);
    expect(await db.pedidos.count()).toBe(5);
    expect(await db.compras.count()).toBe(7);
    expect(JSON.parse(storage.get("chefgestao:demo-ids")!)).toMatchObject({
      ingredientes: expect.arrayContaining([expect.any(Number)]),
      receitas: expect.any(Array),
      clientes: expect.any(Array),
      pedidos: expect.any(Array),
      compras: expect.any(Array),
    });

    const ingredientes = new Set((await db.ingredientes.toArray()).map((ing) => ing.id));
    const receitas = await db.receitas.toArray();
    expect(
      receitas.flatMap((r) => r.ingredientes).every((l) => ingredientes.has(l.ingredienteId)),
    ).toBe(true);
    expect((await db.pedidos.toArray()).every((p) => p.itens.length > 0)).toBe(true);
  });

  it("usa nomes traduzidos quando o idioma do onboarding é inglês", async () => {
    await i18n.changeLanguage("en");
    await criarDadosExemplo();
    expect((await db.ingredientes.orderBy("nome").first())?.nome).toBe("70% chocolate");
    expect((await db.receitas.orderBy("nome").first())?.nome).toBe("Chocolate cake");
  });
});
