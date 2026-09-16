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
  ingredientes: [
    {
      id: 1,
      nome: "Farinha",
      unidade: "g",
      quantidadeEmbalagem: 1000,
      precoEmbalagem: 2,
      stock: 1000,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  receitas: [],
  clientes: [],
  pedidos: [],
});

describe("validarBackup", () => {
  it("aceita um backup válido e conta os registos", () => {
    const { contagem } = validarBackup(valido);
    expect(contagem).toEqual({ ingredientes: 1, receitas: 0, clientes: 0, pedidos: 0 });
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

  it("rejeita registos internos incompletos", () => {
    const dados = JSON.parse(valido);
    dados.ingredientes[0].quantidadeEmbalagem = 0;
    expect(() => validarBackup(JSON.stringify(dados))).toThrow(msg("backupLib.naoEBackup"));
  });

  it("rejeita referências de pedidos inexistentes", () => {
    const dados = JSON.parse(valido);
    dados.clientes.push({
      id: 1,
      nome: "Cliente",
      telefone: "",
      endereco: "",
      nif: "",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    dados.receitas.push({
      id: 1,
      nome: "Receita",
      rendimento: 1,
      unidadeRendimento: "un",
      ingredientes: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    dados.pedidos.push({
      id: 1,
      clienteId: 1,
      itens: [{ receitaId: 999, quantidade: 1, precoUnitario: 1 }],
      dataEntrega: "2026-01-01",
      estado: "pendente",
      notas: "",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(() => validarBackup(JSON.stringify(dados))).toThrow(msg("backupLib.naoEBackup"));
  });

  it("rejeita datas de entrega que não existem no calendário", () => {
    const dados = JSON.parse(valido);
    dados.clientes.push({
      id: 1,
      nome: "Cliente",
      telefone: "",
      endereco: "",
      nif: "",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    dados.receitas.push({
      id: 1,
      nome: "Receita",
      rendimento: 1,
      unidadeRendimento: "un",
      ingredientes: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    dados.pedidos.push({
      id: 1,
      clienteId: 1,
      itens: [{ receitaId: 1, quantidade: 1, precoUnitario: 1 }],
      dataEntrega: "2026-02-30",
      estado: "pendente",
      notas: "",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(() => validarBackup(JSON.stringify(dados))).toThrow(msg("backupLib.naoEBackup"));
  });

  it.each(["compras", "producoes"] as const)("rejeita ids duplicados em %s", (tabela) => {
    const dados = JSON.parse(valido);
    if (tabela === "compras") {
      dados.compras = [
        {
          id: 1,
          nome: "Farinha",
          quantidade: 1,
          unidade: "kg",
          valor: 2,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: 1,
          nome: "Açúcar",
          quantidade: 1,
          unidade: "kg",
          valor: 2,
          createdAt: "2026-01-02T00:00:00.000Z",
        },
      ];
    } else {
      dados.producoes = [
        {
          id: 1,
          receitaId: 99,
          nome: "Receita removida",
          lotes: 1,
          doses: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: 1,
          receitaId: 99,
          nome: "Receita removida",
          lotes: 1,
          doses: 1,
          createdAt: "2026-01-02T00:00:00.000Z",
        },
      ];
    }
    expect(() => validarBackup(JSON.stringify(dados))).toThrow(msg("backupLib.naoEBackup"));
  });
});
