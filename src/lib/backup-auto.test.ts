import "fake-indexeddb/auto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import {
  backupParaPasta,
  backupAutomatico,
  definirPastaBackupExtra,
  pastaBackupExtra,
  ultimoBackupAuto,
} from "./backup-auto";

const fsMock = vi.hoisted(() => ({
  BaseDirectory: { AppData: "AppData" },
  exists: vi.fn(),
  mkdir: vi.fn(),
  writeTextFile: vi.fn(),
  readDir: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => fsMock);

function storageStub() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  vi.stubGlobal("localStorage", storageStub());
  vi.clearAllMocks();
  fsMock.remove.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
});
afterAll(() => db.delete());

describe("backup automático", () => {
  it("lê e atualiza a pasta adicional, incluindo a remoção da configuração", () => {
    expect(pastaBackupExtra()).toBeNull();
    definirPastaBackupExtra("/Volumes/Nuvem/backups");
    expect(pastaBackupExtra()).toBe("/Volumes/Nuvem/backups");
    definirPastaBackupExtra(null);
    expect(pastaBackupExtra()).toBeNull();
  });

  it("devolve vazio quando ainda não há backup registado", () => {
    expect(ultimoBackupAuto()).toBe("");
  });

  it("não tenta usar Tauri nem altera estado no browser", async () => {
    await expect(backupAutomatico()).resolves.toBeUndefined();
    expect(ultimoBackupAuto()).toBe("");
  });

  it("cria o backup diário e remove ficheiros antigos das duas marcas", async () => {
    await db.ingredientes.add({
      id: 1,
      nome: "Farinha",
      unidade: "g",
      quantidadeEmbalagem: 1000,
      precoEmbalagem: 2,
      stock: 500,
      createdAt: new Date(),
    });
    const hoje = new Date().toISOString().slice(0, 10);
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    fsMock.exists.mockResolvedValue(false);
    fsMock.readDir.mockResolvedValue([
      { name: "caderninho-backup-2020-01-01.json" },
      { name: "chefgestao-backup-2020-07-01.json" },
      { name: "not-a-backup.txt" },
    ]);

    await backupAutomatico();

    expect(fsMock.mkdir).toHaveBeenCalledWith("backups", {
      baseDir: "AppData",
      recursive: true,
    });
    expect(fsMock.writeTextFile).toHaveBeenCalledWith(
      `backups/caderninho-backup-${hoje}.json`,
      expect.stringContaining('"app":"chefgestao"'),
      { baseDir: "AppData" },
    );
    expect(fsMock.remove).toHaveBeenCalledWith("backups/caderninho-backup-2020-01-01.json", {
      baseDir: "AppData",
    });
    expect(fsMock.remove).toHaveBeenCalledWith("backups/chefgestao-backup-2020-07-01.json", {
      baseDir: "AppData",
    });
    expect(ultimoBackupAuto()).toBe(hoje);
  });

  it("mantém o backup principal quando a pasta sincronizada falha", async () => {
    await db.ingredientes.add({
      id: 1,
      nome: "Farinha",
      unidade: "g",
      quantidadeEmbalagem: 1000,
      precoEmbalagem: 2,
      stock: 500,
      createdAt: new Date(),
    });
    const hoje = new Date().toISOString().slice(0, 10);
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    definirPastaBackupExtra("/cloud/backups");
    fsMock.exists.mockImplementation(async (path: string) => path === "backups");
    fsMock.readDir.mockResolvedValue([]);
    fsMock.writeTextFile.mockImplementation(async (path: string) => {
      if (path.startsWith("/cloud/")) throw new Error("disco removido");
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(backupAutomatico()).resolves.toBeUndefined();

    expect(fsMock.writeTextFile).toHaveBeenCalledWith(
      `backups/caderninho-backup-${hoje}.json`,
      expect.any(String),
      { baseDir: "AppData" },
    );
    expect(error).toHaveBeenCalledWith("Backup para a pasta adicional falhou:", expect.any(Error));
  });

  it("grava um backup imediato na pasta escolhida", async () => {
    await db.ingredientes.add({
      id: 1,
      nome: "Farinha",
      unidade: "g",
      quantidadeEmbalagem: 1000,
      precoEmbalagem: 2,
      stock: 500,
      createdAt: new Date(),
    });
    fsMock.writeTextFile.mockResolvedValue(undefined);
    const hoje = new Date().toISOString().slice(0, 10);

    await backupParaPasta("/cloud/backups");

    expect(fsMock.writeTextFile).toHaveBeenCalledWith(
      `/cloud/backups/caderninho-backup-${hoje}.json`,
      expect.stringContaining('"app":"chefgestao"'),
    );
  });
});
