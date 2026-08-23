import { useSyncExternalStore } from "react";
import { db } from "@/lib/db";
import { recolherDados, emTauri } from "@/lib/backup";

/**
 * Backup automático silencioso (proteção de dados).
 *
 * Camada 1: no arranque da app Tauri grava um JSON (formato do backup
 * manual) em `$APPDATA/backups`, no máximo um por dia, com retenção de
 * 60 dias. Camada 2: se o utilizador escolher uma pasta adicional nas
 * Definições (ex.: iCloud Drive, Google Drive), o mesmo backup e a mesma
 * rotação aplicam-se lá — o cliente de sincronização da nuvem faz o resto.
 *
 * No browser de desenvolvimento não faz nada. Nunca lança erros — falhar
 * o backup não pode impedir a app de abrir.
 */

const PASTA = "backups";
const PREFIXO = "caderninho-backup-";
/** Prefixo da marca anterior — os ficheiros antigos ainda contam para a rotação. */
const PREFIXO_LEGADO = "chefgestao-backup-";
const DIAS_RETENCAO = 60;

const ULTIMO_KEY = "chefgestao:ultimo-backup-auto";
const PASTA_EXTRA_KEY = "chefgestao:pasta-backup-extra";

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function dataLocalISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

/** "2026-08-23" do último backup automático, ou "" se nunca correu. */
export function ultimoBackupAuto(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(ULTIMO_KEY) ?? "";
}

/** Pasta adicional (sincronizada com a nuvem), ou null se não configurada. */
export function pastaBackupExtra(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(PASTA_EXTRA_KEY);
}

export function definirPastaBackupExtra(pasta: string | null): void {
  if (pasta) localStorage.setItem(PASTA_EXTRA_KEY, pasta);
  else localStorage.removeItem(PASTA_EXTRA_KEY);
  listeners.forEach((l) => l());
}

export function usePastaBackupExtra(): string | null {
  return useSyncExternalStore(subscribe, pastaBackupExtra, () => null);
}

function limiteRetencaoISO(): string {
  const limite = new Date();
  limite.setDate(limite.getDate() - DIAS_RETENCAO);
  return dataLocalISO(limite);
}

function ehBackupAntigo(nome: string, limiteISO: string): boolean {
  const prefixo = nome.startsWith(PREFIXO)
    ? PREFIXO
    : nome.startsWith(PREFIXO_LEGADO)
      ? PREFIXO_LEGADO
      : null;
  if (!prefixo || !nome.endsWith(".json")) return false;
  const data = nome.slice(prefixo.length, prefixo.length + 10);
  return data < limiteISO;
}

/** Backup imediato para uma pasta escolhida (ação explícita nas Definições). */
export async function backupParaPasta(pasta: string): Promise<void> {
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  const dados = await recolherDados();
  const nome = `${PREFIXO}${dataLocalISO(new Date())}.json`;
  await writeTextFile(`${pasta}/${nome}`, JSON.stringify(dados));
}

export async function backupAutomatico(): Promise<void> {
  if (!emTauri()) return;
  try {
    // Base de dados vazia (instalação nova) — nada para proteger.
    const [nIng, nRec, nCli, nPed] = await Promise.all([
      db.ingredientes.count(),
      db.receitas.count(),
      db.clientes.count(),
      db.pedidos.count(),
    ]);
    if (nIng + nRec + nCli + nPed === 0) return;

    const fs = await import("@tauri-apps/plugin-fs");
    const base = { baseDir: fs.BaseDirectory.AppData };

    const hoje = dataLocalISO(new Date());
    const nomeFicheiro = `${PREFIXO}${hoje}.json`;
    const limiteISO = limiteRetencaoISO();

    // O JSON só é gerado se algum destino precisar dele.
    let json: string | null = null;
    const obterJson = async () => (json ??= JSON.stringify(await recolherDados()));

    // Camada 1: $APPDATA/backups
    if (!(await fs.exists(PASTA, base))) {
      await fs.mkdir(PASTA, { ...base, recursive: true });
    }
    if (!(await fs.exists(`${PASTA}/${nomeFicheiro}`, base))) {
      await fs.writeTextFile(`${PASTA}/${nomeFicheiro}`, await obterJson(), base);
    }
    localStorage.setItem(ULTIMO_KEY, hoje);
    for (const e of await fs.readDir(PASTA, base)) {
      if (ehBackupAntigo(e.name ?? "", limiteISO)) {
        await fs.remove(`${PASTA}/${e.name}`, base).catch(() => {});
      }
    }

    // Camada 2: pasta adicional sincronizada (se configurada). Uma pasta
    // indisponível (disco externo removido, sessão iCloud…) não pode
    // estragar a camada 1 — erros ficam contidos aqui.
    const extra = pastaBackupExtra();
    if (extra) {
      try {
        if (!(await fs.exists(`${extra}/${nomeFicheiro}`))) {
          await fs.writeTextFile(`${extra}/${nomeFicheiro}`, await obterJson());
        }
        for (const e of await fs.readDir(extra)) {
          if (ehBackupAntigo(e.name ?? "", limiteISO)) {
            await fs.remove(`${extra}/${e.name}`).catch(() => {});
          }
        }
      } catch (err) {
        console.error("Backup para a pasta adicional falhou:", err);
      }
    }
  } catch (err) {
    console.error("Backup automático falhou:", err);
  }
}
