import { describe, expect, it } from "vitest";
import { validarBackup } from "@/lib/backup";
import i18n from "@/lib/i18n";

/**
 * As mensagens são traduzidas, por isso comparam-se com o que o i18n resolve
 * e não com texto fixo: assim o teste não depende do idioma do sistema onde
 * corre (em CI não há locale pt) nem parte quando uma tradução é reescrita.
 */
const msg = (chave: string) => i18n.t(chave);

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
    expect(() => validarBackup("{isto não é json")).toThrow(msg("backupLib.jsonIlegivel"));
  });

  it("rejeita ficheiros de outra aplicação", () => {
    expect(() => validarBackup(JSON.stringify({ app: "outra", ingredientes: [] }))).toThrow(
      msg("backupLib.naoEBackup"),
    );
  });

  it("distingue as duas rejeições", () => {
    // Sem isto, os dois testes acima passariam mesmo que ambas as chaves
    // caíssem na mesma mensagem (ou numa string vazia).
    expect(msg("backupLib.jsonIlegivel")).not.toBe(msg("backupLib.naoEBackup"));
    expect(msg("backupLib.jsonIlegivel")).not.toBe("backupLib.jsonIlegivel");
  });

  it("aceita backups antigos sem a tabela de compras", () => {
    expect(() => validarBackup(valido)).not.toThrow();
  });
});
