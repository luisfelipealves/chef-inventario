import { db } from "@/lib/db";
import { recolherDados, emTauri } from "@/lib/backup";

/**
 * Backup automático silencioso (camada 1 da proteção de dados).
 *
 * No arranque da app Tauri grava um JSON (formato do backup manual) em
 * `$APPDATA/backups`, no máximo um por dia, e apaga os com mais de 60 dias.
 * No browser de desenvolvimento não faz nada. Nunca lança erros — falhar o
 * backup não pode impedir a app de abrir.
 */

const PASTA = "backups";
const PREFIXO = "chefgestao-backup-";
const DIAS_RETENCAO = 60;

const ULTIMO_KEY = "chefgestao:ultimo-backup-auto";

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

    const { BaseDirectory, exists, mkdir, readDir, remove, writeTextFile } =
      await import("@tauri-apps/plugin-fs");
    const base = { baseDir: BaseDirectory.AppData };

    const hoje = dataLocalISO(new Date());
    const nome = `${PASTA}/${PREFIXO}${hoje}.json`;

    if (!(await exists(PASTA, base))) {
      await mkdir(PASTA, { ...base, recursive: true });
    }

    // No máximo um backup por dia.
    if (!(await exists(nome, base))) {
      const dados = await recolherDados();
      await writeTextFile(nome, JSON.stringify(dados), base);
    }
    localStorage.setItem(ULTIMO_KEY, hoje);

    // Rotação: remove backups com mais de 60 dias (datas ISO comparam por texto).
    const limite = new Date();
    limite.setDate(limite.getDate() - DIAS_RETENCAO);
    const limiteISO = dataLocalISO(limite);
    const entradas = await readDir(PASTA, base);
    for (const e of entradas) {
      const n = e.name ?? "";
      if (!n.startsWith(PREFIXO) || !n.endsWith(".json")) continue;
      const dataFicheiro = n.slice(PREFIXO.length, PREFIXO.length + 10);
      if (dataFicheiro < limiteISO) {
        await remove(`${PASTA}/${n}`, base).catch(() => {});
      }
    }
  } catch (err) {
    console.error("Backup automático falhou:", err);
  }
}
