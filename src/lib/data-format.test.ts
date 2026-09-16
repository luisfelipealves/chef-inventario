import { describe, expect, it } from "vitest";
import { dataHora } from "./data-format";
import { localeAtual } from "./i18n";

describe("dataHora", () => {
  it("formata data e hora de acordo com o idioma atual", () => {
    const data = new Date("2026-09-16T14:30:00Z");
    const esperado = new Intl.DateTimeFormat(localeAtual(), {
      dateStyle: "short",
      timeStyle: "short",
    }).format(data);

    expect(dataHora(data)).toBe(esperado);
  });

  it("devolve travessão para uma data inválida", () => {
    expect(dataHora(new Date("invalid"))).toBe("—");
  });
});
