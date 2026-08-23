import { describe, expect, it } from "vitest";
import type { Ingrediente, Receita } from "@/lib/db";
import { custoDoseReceita, totaisPedido } from "@/lib/pedido-calc";

const farinha: Ingrediente = {
  id: 1,
  nome: "Farinha",
  unidade: "kg",
  quantidadeEmbalagem: 5,
  precoEmbalagem: 5, // 1 €/kg
  createdAt: new Date(2026, 0, 1),
};

const bolo: Receita = {
  id: 10,
  nome: "Bolo",
  rendimento: 10,
  unidadeRendimento: "un",
  precoVenda: 3,
  ingredientes: [{ ingredienteId: 1, quantidade: 2 }], // 2 kg → 2 € → 0,20 €/dose
  createdAt: new Date(2026, 0, 1),
};

const ingMap = new Map([[farinha.id, farinha]]);
const receitaMap = new Map([[bolo.id, bolo]]);

describe("custoDoseReceita", () => {
  it("custo total da receita a dividir pelo rendimento", () => {
    expect(custoDoseReceita(bolo, ingMap)).toBeCloseTo(0.2);
  });

  it("devolve 0 para receita removida", () => {
    expect(custoDoseReceita(undefined, ingMap)).toBe(0);
  });
});

describe("totaisPedido", () => {
  it("calcula custo, venda, lucro e margem", () => {
    const t = totaisPedido(
      [{ receitaId: bolo.id, quantidade: 10, precoUnitario: 3 }],
      receitaMap,
      ingMap,
    );
    expect(t.custo).toBeCloseTo(2); // 0,20 € × 10
    expect(t.venda).toBeCloseTo(30);
    expect(t.lucro).toBeCloseTo(28);
    expect(t.margem).toBeCloseTo(1400); // 28 / 2 × 100
  });

  it("receita removida conta venda mas custo 0", () => {
    const t = totaisPedido(
      [{ receitaId: 999, quantidade: 2, precoUnitario: 5 }],
      receitaMap,
      ingMap,
    );
    expect(t.custo).toBe(0);
    expect(t.venda).toBe(10);
    expect(t.margem).toBe(0); // sem custo, margem indefinida → 0
  });

  it("pedido vazio dá tudo a zero", () => {
    const t = totaisPedido([], receitaMap, ingMap);
    expect(t).toEqual({ custo: 0, venda: 0, lucro: 0, margem: 0 });
  });
});
