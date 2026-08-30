import { describe, expect, it } from "vitest";
import type { Ingrediente, Receita } from "@/lib/db";
import { custoLinha, custoTotalReceita, custoPorDose } from "@/lib/receita-custo";

function ing(
  id: number,
  quantidadeEmbalagem: number,
  precoEmbalagem: number,
  stock?: number,
): Ingrediente {
  return {
    id,
    nome: `Ingrediente ${id}`,
    unidade: "g",
    quantidadeEmbalagem,
    precoEmbalagem,
    ...(stock != null ? { stock } : {}),
    createdAt: new Date(2026, 0, 1),
  };
}

describe("custoLinha", () => {
  it("calcula custo unitário × quantidade", () => {
    // 1000 g custam 5 € → 0,005 €/g; 200 g → 1 €
    expect(custoLinha({ ingredienteId: 1, quantidade: 200 }, ing(1, 1000, 5))).toBeCloseTo(1);
  });

  it("devolve 0 para ingrediente removido", () => {
    expect(custoLinha({ ingredienteId: 1, quantidade: 200 }, undefined)).toBe(0);
  });

  it("devolve 0 quando a embalagem tem quantidade 0 (evita divisão por zero)", () => {
    expect(custoLinha({ ingredienteId: 1, quantidade: 200 }, ing(1, 0, 5))).toBe(0);
  });
});

describe("custoTotalReceita", () => {
  it("soma as linhas, ignorando ingredientes em falta no mapa", () => {
    const mapa = new Map<number, Ingrediente>([
      [1, ing(1, 1000, 5)], // 0,005 €/g
      [2, ing(2, 500, 2)], // 0,004 €/g
    ]);
    const receita: Pick<Receita, "ingredientes"> = {
      ingredientes: [
        { ingredienteId: 1, quantidade: 100 }, // 0,50 €
        { ingredienteId: 2, quantidade: 250 }, // 1,00 €
        { ingredienteId: 99, quantidade: 999 }, // removido → 0
      ],
    };
    expect(custoTotalReceita(receita, mapa)).toBeCloseTo(1.5);
  });
});

describe("custo é independente do stock em despensa", () => {
  // Regressão: até à v6 as produções abatiam em `quantidadeEmbalagem`, o
  // divisor do custo unitário. O custo da receita subia a cada produção e
  // caía a 0 quando a despensa esvaziava.
  const linha = { ingredienteId: 1, quantidade: 500 };

  it("gasta metade do stock e o custo não se mexe", () => {
    const cheio = custoLinha(linha, ing(1, 1000, 2, 1000));
    const meio = custoLinha(linha, ing(1, 1000, 2, 500));
    expect(cheio).toBeCloseTo(1);
    expect(meio).toBeCloseTo(cheio);
  });

  it("despensa a zero não zera o custo da receita", () => {
    expect(custoLinha(linha, ing(1, 1000, 2, 0))).toBeCloseTo(1);
  });

  it("registos anteriores à v7 (sem stock) mantêm o custo", () => {
    expect(custoLinha(linha, ing(1, 1000, 2))).toBeCloseTo(1);
  });
});

describe("custoPorDose", () => {
  it("divide o total pelo rendimento", () => {
    expect(custoPorDose(12, 4)).toBe(3);
  });

  it("devolve 0 com rendimento 0 ou negativo", () => {
    expect(custoPorDose(12, 0)).toBe(0);
    expect(custoPorDose(12, -1)).toBe(0);
  });
});
