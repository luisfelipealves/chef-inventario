import { describe, expect, it } from "vitest";
import { custoPorUnidade, formatEuro } from "@/lib/format";

/** O Intl pt-PT usa espaços especiais; normaliza para comparar. */
function plano(s: string): string {
  return s.replace(/[\u202F\u00A0]/g, " ");
}

describe("formatEuro", () => {
  it("formata euros em pt-PT", () => {
    // pt-PT (CLDR) só agrupa milhares a partir de 5 dígitos
    expect(plano(formatEuro(1234.5))).toBe("1234,50 €");
    expect(plano(formatEuro(12345.5))).toBe("12 345,50 €");
  });

  it("usa 4 casas para valores muito pequenos (preço por grama)", () => {
    expect(plano(formatEuro(0.0045))).toBe("0,0045 €");
  });

  it("modo compacto mantém 2 casas mínimas", () => {
    expect(plano(formatEuro(3, { compact: true }))).toBe("3,00 €");
  });

  it("devolve travessão para valores não finitos", () => {
    expect(formatEuro(Number.NaN)).toBe("—");
    expect(formatEuro(Infinity)).toBe("—");
  });
});

describe("custoPorUnidade", () => {
  it("divide preço pela quantidade", () => {
    expect(custoPorUnidade(5, 1000)).toBeCloseTo(0.005);
  });

  it("devolve 0 com quantidade 0 ou negativa", () => {
    expect(custoPorUnidade(5, 0)).toBe(0);
    expect(custoPorUnidade(5, -2)).toBe(0);
  });
});
