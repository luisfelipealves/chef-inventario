import { describe, expect, it } from "vitest";
import type { Producao } from "./db";
import { ordenarProducoesMaisRecentes } from "./producao-historico";

function producao(id: number, createdAt: string): Producao {
  return {
    id,
    receitaId: 1,
    nome: "Bolo",
    lotes: 1,
    doses: 6,
    createdAt: new Date(createdAt),
  };
}

describe("ordenarProducoesMaisRecentes", () => {
  it("mostra as produções mais recentes primeiro", () => {
    const antigas = producao(1, "2026-09-15T10:00:00Z");
    const recentes = producao(2, "2026-09-16T10:00:00Z");

    expect(ordenarProducoesMaisRecentes([antigas, recentes]).map((p) => p.id)).toEqual([2, 1]);
  });

  it("usa o id como desempate e não altera a lista original", () => {
    const primeiro = producao(1, "2026-09-16T10:00:00Z");
    const segundo = producao(2, "2026-09-16T10:00:00Z");
    const lista = [primeiro, segundo];

    expect(ordenarProducoesMaisRecentes(lista).map((p) => p.id)).toEqual([2, 1]);
    expect(lista.map((p) => p.id)).toEqual([1, 2]);
  });
});
