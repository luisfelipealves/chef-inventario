import {
  db,
  type Cliente,
  type Compra,
  type Ingrediente,
  type Pedido,
  type Producao,
  type Receita,
} from "@/lib/db";

/**
 * Cópia de segurança / migração de dados.
 *
 * A app é local-first (IndexedDB) e não sincroniza com a nuvem. Para migrar
 * para um computador novo: exportar um ficheiro .json aqui e importá-lo na
 * instalação nova. As chaves primárias são preservadas, mantendo as relações
 * entre pedidos, receitas, clientes e ingredientes.
 */

export interface BackupData {
  app: "chefgestao";
  versao: 1;
  exportadoEm: string;
  ingredientes: Ingrediente[];
  receitas: Receita[];
  clientes: Cliente[];
  pedidos: Pedido[];
  /** Ausente em backups anteriores à v0.6 — importa como vazio. */
  compras?: Compra[];
  /** Ausente em backups anteriores à v1.1 — importa como vazio. */
  producoes?: Producao[];
}

export interface ContagemBackup {
  ingredientes: number;
  receitas: number;
  clientes: number;
  pedidos: number;
}

export async function recolherDados(): Promise<BackupData> {
  const [ingredientes, receitas, clientes, pedidos, compras, producoes] = await Promise.all([
    db.ingredientes.toArray(),
    db.receitas.toArray(),
    db.clientes.toArray(),
    db.pedidos.toArray(),
    db.compras.toArray(),
    db.producoes.toArray(),
  ]);
  return {
    app: "chefgestao",
    versao: 1,
    exportadoEm: new Date().toISOString(),
    ingredientes,
    receitas,
    clientes,
    pedidos,
    compras,
    producoes,
  };
}

/** True quando corre dentro da app Tauri (não no browser de desenvolvimento). */
export function emTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Gera e grava o ficheiro de cópia de segurança.
 * - Na app Tauri: abre um diálogo "Guardar como" nativo (o download por blob
 *   não funciona no WKWebView do macOS).
 * - No browser: descarrega via <a download>.
 * Devolve o nome do ficheiro, ou null se o utilizador cancelar.
 */
export async function exportarBackup(): Promise<string | null> {
  const dados = await recolherDados();
  const json = JSON.stringify(dados, null, 2);
  const nome = `chefgestao-backup-${dados.exportadoEm.slice(0, 10)}.json`;

  if (emTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const caminho = await save({
      defaultPath: nome,
      filters: [{ name: "Cópia de segurança", extensions: ["json"] }],
    });
    if (!caminho) return null;
    await writeTextFile(caminho, json);
    return nome;
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return nome;
}

/**
 * Abre um diálogo nativo para escolher e ler um ficheiro de backup (Tauri).
 * Devolve o texto do ficheiro, ou null se cancelado.
 */
export async function abrirBackupNativo(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const caminho = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Cópia de segurança", extensions: ["json"] }],
  });
  if (!caminho || typeof caminho !== "string") return null;
  return readTextFile(caminho);
}

function reviverDatas<T extends { createdAt: unknown }>(arr: T[]): T[] {
  return arr.map((x) => ({ ...x, createdAt: new Date(x.createdAt as string) }));
}

/** Valida o texto de um ficheiro de backup e devolve as contagens (sem importar). */
export function validarBackup(texto: string): { dados: BackupData; contagem: ContagemBackup } {
  let dados: BackupData;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error("Ficheiro inválido — não é um JSON legível.");
  }
  const ok =
    dados &&
    dados.app === "chefgestao" &&
    Array.isArray(dados.ingredientes) &&
    Array.isArray(dados.receitas) &&
    Array.isArray(dados.clientes) &&
    Array.isArray(dados.pedidos);
  if (!ok) {
    throw new Error("Este ficheiro não é uma cópia de segurança do ChefGestão.");
  }
  return {
    dados,
    contagem: {
      ingredientes: dados.ingredientes.length,
      receitas: dados.receitas.length,
      clientes: dados.clientes.length,
      pedidos: dados.pedidos.length,
    },
  };
}

/**
 * Substitui TODOS os dados atuais pelos do backup. Operação destrutiva —
 * confirmar com o utilizador antes de chamar.
 */
export async function importarBackup(dados: BackupData): Promise<ContagemBackup> {
  await db.transaction(
    "rw",
    [db.ingredientes, db.receitas, db.clientes, db.pedidos, db.compras, db.producoes],
    async () => {
      await Promise.all([
        db.ingredientes.clear(),
        db.receitas.clear(),
        db.clientes.clear(),
        db.pedidos.clear(),
        db.compras.clear(),
        db.producoes.clear(),
      ]);
      await db.ingredientes.bulkAdd(reviverDatas(dados.ingredientes));
      await db.receitas.bulkAdd(reviverDatas(dados.receitas));
      await db.clientes.bulkAdd(reviverDatas(dados.clientes));
      await db.pedidos.bulkAdd(reviverDatas(dados.pedidos));
      await db.compras.bulkAdd(reviverDatas(dados.compras ?? []));
      await db.producoes.bulkAdd(reviverDatas(dados.producoes ?? []));
    },
  );
  return {
    ingredientes: dados.ingredientes.length,
    receitas: dados.receitas.length,
    clientes: dados.clientes.length,
    pedidos: dados.pedidos.length,
  };
}
