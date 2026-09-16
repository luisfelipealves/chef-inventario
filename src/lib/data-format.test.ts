import { describe, expect, it } from "vitest";
import { dataComAno, dataEntregaCurta, dataEntregaLonga, dataHora, parseData } from "./data-format";
import i18n, { localeAtual } from "./i18n";

import { afterEach } from "vitest";

afterEach(() => void i18n.changeLanguage("pt-PT"));

describe("parseData e etiquetas de entrega", () => {
  it("aceita uma data ISO local sem deslocar o dia", () => {
    const data = parseData("2026-08-24");
    expect(data).not.toBeNull();
    expect([data?.getFullYear(), data?.getMonth(), data?.getDate()]).toEqual([2026, 7, 24]);
  });

  it.each(["", "24-08-2026", "2026-02-30", "2026-13-01"])(
    "rejeita data de calendário inválida: %s",
    (data) => {
      expect(parseData(data)).toBeNull();
      expect(dataEntregaCurta(data)).toBe("—");
      expect(dataEntregaLonga(data)).toBe("—");
      expect(dataComAno(data)).toBe("—");
    },
  );

  it("compõe as etiquetas em português com e sem ano", async () => {
    await i18n.changeLanguage("pt-PT");
    expect(dataEntregaCurta("2026-08-24")).toBe("24 ago");
    expect(dataEntregaLonga("2026-08-24")).toBe("segunda, 24 ago");
    expect(dataComAno("2026-08-24")).toBe("24 ago 2026");
  });

  it("acompanha o idioma inglês e o locale usado pelo Intl", async () => {
    await i18n.changeLanguage("en");
    const data = new Date(2026, 7, 24);
    const mes = new Intl.DateTimeFormat(localeAtual(), { month: "short" }).format(data);
    const semana = new Intl.DateTimeFormat(localeAtual(), { weekday: "long" }).format(data);
    expect(dataEntregaCurta("2026-08-24")).toBe(`24 ${mes}`);
    expect(dataEntregaLonga("2026-08-24")).toBe(`${semana}, 24 ${mes}`);
    expect(dataComAno("2026-08-24")).toBe(`24 ${mes} 2026`);
  });
});

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
