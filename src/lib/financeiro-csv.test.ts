import { describe, expect, it } from "vitest";
import { gerarCsv, type MovimentoCsv } from "@/lib/financeiro-csv";

function mov(parcial: Partial<MovimentoCsv>): MovimentoCsv {
  return {
    data: new Date(2026, 7, 23),
    tipo: "Receita",
    descricao: "Pedido nº 1",
    contraparte: "Maria",
    estado: "Entregue",
    valor: 10,
    ...parcial,
  };
}

describe("gerarCsv", () => {
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
