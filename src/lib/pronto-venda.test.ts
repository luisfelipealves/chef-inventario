import { describe, expect, it } from "vitest";
import type { Receita } from "./db";
import { receitasProntas } from "./pronto-venda";

function receita(id: number, nome: string, dosesProntas?: number): Receita {
  return {
    id,
    nome,
    rendimento: 1,
    unidadeRendimento: "un",
    ingredientes: [],
    dosesProntas,
    createdAt: new Date("2026-09-16T12:00:00Z"),
  };
}

describe("receitasProntas", () => {
  it("inclui apenas receitas com saldo positivo", () => {
    const receitas = [
      receita(1, "Bolo", 4),
      receita(2, "Tarte", 0),
      receita(3, "Pão", undefined),
      receita(4, "Quiche", -1),
    ];

    expect(receitasProntas(receitas)).toEqual([receitas[0]]);
  });

  it("não altera a ordem original da lista", () => {
    const receitas = [receita(2, "Tarte", 2), receita(1, "Bolo", 1)];

    expect(receitasProntas(receitas).map((r) => r.id)).toEqual([2, 1]);
    expect(receitas.map((r) => r.id)).toEqual([2, 1]);
  });
});
