import { describe, expect, it } from "vitest";
import { validarBackup } from "@/lib/backup";

const valido = JSON.stringify({
  app: "chefgestao",
  versao: 1,
  exportadoEm: "2026-08-23T10:00:00.000Z",
  ingredientes: [{ id: 1, nome: "Farinha", createdAt: "2026-01-01T00:00:00.000Z" }],
  receitas: [],
  clientes: [],
  pedidos: [{ id: 1, createdAt: "2026-01-01T00:00:00.000Z" }],
});

describe("validarBackup", () => {
  it("aceita um backup válido e conta os registos", () => {
    const { contagem } = validarBackup(valido);
    expect(contagem).toEqual({ ingredientes: 1, receitas: 0, clientes: 0, pedidos: 1 });
  });

  it("rejeita JSON ilegível", () => {
    expect(() => validarBackup("{isto não é json")).toThrow(/inválido/i);
  });

  it("rejeita ficheiros de outra aplicação", () => {
    expect(() => validarBackup(JSON.stringify({ app: "outra", ingredientes: [] }))).toThrow(
      /não é uma cópia de segurança/i,
    );
  });

  it("aceita backups antigos sem a tabela de compras", () => {
    expect(() => validarBackup(valido)).not.toThrow();
  });
});
