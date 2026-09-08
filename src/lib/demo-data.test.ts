import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import { apagarDadosExemplo } from "./demo-data";

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
