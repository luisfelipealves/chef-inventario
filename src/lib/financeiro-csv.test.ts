import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/lib/i18n";
import { exportarFinanceiroCsv, gerarCsv, type MovimentoCsv } from "@/lib/financeiro-csv";

function mov(parcial: Partial<MovimentoCsv>): MovimentoCsv {
  return {
    data: new Date(2026, 7, 23),
    tipo: "receita",
    descricao: "Pedido nº 1",
    contraparte: "Maria",
    estado: "Entregue",
    valor: 10,
    ...parcial,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("gerarCsv (pt-PT)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-PT");
  });

  it("começa com BOM e cabeçalho", () => {
    const csv = gerarCsv([]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Data;Tipo;Descrição;Cliente/Fornecedor;Estado;Valor (EUR)");
  });

  it("formata datas ISO e valores com vírgula decimal", () => {
    const csv = gerarCsv([mov({ data: new Date(2026, 0, 5), valor: 1234.5 })]);
    expect(csv).toContain("2026-01-05;Receita;Pedido nº 1;Maria;Entregue;1234,50");
  });

  it("ordena por data ascendente", () => {
    const csv = gerarCsv([
      mov({ data: new Date(2026, 7, 20), descricao: "B" }),
      mov({ data: new Date(2026, 7, 10), descricao: "A" }),
    ]);
    expect(csv.indexOf(";A;")).toBeLessThan(csv.indexOf(";B;"));
  });

  it("protege campos com ponto e vírgula ou aspas", () => {
    const csv = gerarCsv([mov({ descricao: 'Bolo "grande"; especial' })]);
    expect(csv).toContain('"Bolo ""grande""; especial"');
  });

  it("usa CRLF entre linhas", () => {
    const csv = gerarCsv([mov({})]);
    expect(csv).toContain("\r\n");
  });
});

describe("gerarCsv (en)", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("usa vírgula como separador e ponto decimal", () => {
    const csv = gerarCsv([mov({ data: new Date(2026, 0, 5), valor: 1234.5 })]);
    expect(csv).toContain("Date,Type,Description,Customer/Supplier,Status,Amount (EUR)");
    expect(csv).toContain("2026-01-05,Revenue,Pedido nº 1,Maria,Entregue,1234.50");
  });

  it("protege campos com vírgulas", () => {
    const csv = gerarCsv([mov({ descricao: "Cake, big" })]);
    expect(csv).toContain('"Cake, big"');
  });
});

describe("exportarFinanceiroCsv no browser", () => {
  it("cria um download com nome baseado no período e revoga a URL", async () => {
    await i18n.changeLanguage("pt-PT");
    const anchor = {
      href: "",
      download: "",
      click: vi.fn(),
      remove: vi.fn(),
    };
    const createObjectURL = vi.fn().mockReturnValue("blob:csv");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("document", {
      createElement: vi.fn().mockReturnValue(anchor),
      body: { appendChild: vi.fn() },
    });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.useFakeTimers();

    await expect(
      exportarFinanceiroCsv([mov({})], new Date(2026, 0, 1), new Date(2026, 0, 31)),
    ).resolves.toBe("financeiro-2026-01-01-a-2026-01-31.csv");
    expect(anchor.download).toBe("financeiro-2026-01-01-a-2026-01-31.csv");
    expect(anchor.href).toBe("blob:csv");
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:csv");
    vi.useRealTimers();
  });
});
