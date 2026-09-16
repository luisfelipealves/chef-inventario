import "fake-indexeddb/auto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import {
  abrirBackupNativo,
  exportarBackup,
  importarBackup,
  recolherDados,
  type BackupData,
} from "./backup";

const nativeDialogMock = vi.hoisted(() => ({
  open: vi.fn(),
  save: vi.fn(),
}));
const nativeFsMock = vi.hoisted(() => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => nativeDialogMock);
vi.mock("@tauri-apps/plugin-fs", () => nativeFsMock);

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterAll(() => db.delete());
afterEach(() => vi.unstubAllGlobals());

const data = "2026-08-24T10:30:00.000Z";

function backupCompleto(): BackupData {
  return {
    app: "chefgestao",
    versao: 1,
    exportadoEm: data,
    ingredientes: [
      {
        id: 7,
        nome: "Farinha",
        unidade: "g",
        quantidadeEmbalagem: 1000,
        precoEmbalagem: 2,
        stock: 750,
        createdAt: new Date(data),
      },
    ],
    receitas: [
      {
        id: 8,
        nome: "Bolo",
        rendimento: 4,
        unidadeRendimento: "un",
        ingredientes: [{ ingredienteId: 7, quantidade: 100 }],
        dosesProntas: 2,
        createdAt: new Date(data),
      },
    ],
    clientes: [
      {
        id: 9,
        nome: "Cliente",
        telefone: "",
        endereco: "",
        nif: "",
        createdAt: new Date(data),
      },
    ],
    pedidos: [
      {
        id: 10,
        clienteId: 9,
        itens: [{ receitaId: 8, quantidade: 2, precoUnitario: 3 }],
        dataEntrega: "2026-08-24",
        estado: "confirmado",
        notas: "",
        createdAt: new Date(data),
      },
    ],
    compras: [
      {
        id: 11,
        ingredienteId: 7,
        nome: "Farinha",
        quantidade: 1000,
        unidade: "g",
        valor: 2,
        createdAt: new Date(data),
      },
    ],
    producoes: [
      {
        id: 12,
        receitaId: 8,
        nome: "Bolo",
        lotes: 1,
        doses: 4,
        createdAt: new Date(data),
      },
    ],
  };
}

describe("backup de dados IndexedDB", () => {
  it("recolhe todas as tabelas e preserva datas como Date", async () => {
    await db.ingredientes.add(backupCompleto().ingredientes[0]);
    await db.receitas.add(backupCompleto().receitas[0]);
    await db.clientes.add(backupCompleto().clientes[0]);
    await db.pedidos.add(backupCompleto().pedidos[0]);
    await db.compras.add(backupCompleto().compras![0]);
    await db.producoes.add(backupCompleto().producoes![0]);

    const dados = await recolherDados();
    expect(dados).toMatchObject({ app: "chefgestao", versao: 1 });
    expect(dados.ingredientes).toHaveLength(1);
    expect(dados.receitas).toHaveLength(1);
    expect(dados.clientes).toHaveLength(1);
    expect(dados.pedidos).toHaveLength(1);
    expect(dados.compras).toHaveLength(1);
    expect(dados.producoes).toHaveLength(1);
    expect(dados.producoes?.[0].createdAt).toBeInstanceOf(Date);
  });

  it("substitui dados antigos, mantém ids e revive todas as datas", async () => {
    await db.ingredientes.add({
      id: 99,
      nome: "Antigo",
      unidade: "g",
      quantidadeEmbalagem: 1,
      precoEmbalagem: 1,
      createdAt: new Date(),
    });

    const esperado = backupCompleto();
    await expect(importarBackup(esperado)).resolves.toEqual({
      ingredientes: 1,
      receitas: 1,
      clientes: 1,
      pedidos: 1,
    });
    expect(await db.ingredientes.get(99)).toBeUndefined();
    expect((await db.ingredientes.get(7))?.createdAt).toEqual(new Date(data));
    expect((await db.receitas.get(8))?.dosesProntas).toBe(2);
    expect((await db.pedidos.get(10))?.createdAt).toEqual(new Date(data));
    expect((await db.compras.get(11))?.createdAt).toEqual(new Date(data));
    expect((await db.producoes.get(12))?.createdAt).toEqual(new Date(data));
  });

  it("limpa tabelas opcionais quando importa um backup legado", async () => {
    const completo = backupCompleto();
    await importarBackup(completo);
    const legado = { ...completo, compras: undefined, producoes: undefined } as BackupData;

    await importarBackup(legado);

    expect(await db.compras.count()).toBe(0);
    expect(await db.producoes.count()).toBe(0);
  });

  it("gera o download do backup no browser", async () => {
    const anchor = {
      href: "",
      download: "",
      click: vi.fn(),
      remove: vi.fn(),
    };
    const createObjectURL = vi.fn().mockReturnValue("blob:backup");
    vi.stubGlobal("document", {
      createElement: vi.fn().mockReturnValue(anchor),
      body: { appendChild: vi.fn() },
    });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });

    await expect(exportarBackup()).resolves.toMatch(/^caderninho-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(anchor.href).toBe("blob:backup");
    expect(anchor.download).toMatch(/^caderninho-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("trata cancelamento e leitura do seletor nativo", async () => {
    nativeDialogMock.open.mockResolvedValueOnce(null);
    await expect(abrirBackupNativo()).resolves.toBeNull();

    nativeDialogMock.open.mockResolvedValueOnce("/tmp/backup.json");
    nativeFsMock.readTextFile.mockResolvedValueOnce("{ backup: true }");
    await expect(abrirBackupNativo()).resolves.toBe("{ backup: true }");
    expect(nativeFsMock.readTextFile).toHaveBeenCalledWith("/tmp/backup.json");
  });

  it("trata cancelamento e gravação do exportador nativo", async () => {
    await db.ingredientes.add(backupCompleto().ingredientes[0]);
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    nativeDialogMock.save.mockResolvedValueOnce(null);
    await expect(exportarBackup()).resolves.toBeNull();

    nativeDialogMock.save.mockResolvedValueOnce("/tmp/backup.json");
    nativeFsMock.writeTextFile.mockResolvedValueOnce(undefined);
    const nome = await exportarBackup();
    expect(nome).toMatch(/^caderninho-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(nativeFsMock.writeTextFile).toHaveBeenCalledWith(
      "/tmp/backup.json",
      expect.stringContaining('"app": "chefgestao"'),
    );
  });
});
