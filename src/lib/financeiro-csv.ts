import { emTauri } from "@/lib/backup";
import i18n, { idiomaAtual } from "@/lib/i18n";

/**
 * Exportação CSV dos movimentos do período (para o contabilista).
 * Formato pt-PT: separador ";", decimais com vírgula, UTF-8 com BOM
 * (abre direto no Excel com acentos corretos).
 */

export interface MovimentoCsv {
  data: Date;
  tipo: "receita" | "despesa";
  descricao: string;
  contraparte: string;
  estado: string;
  valor: number;
}

function dataISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

function campo(s: string, sep: string): string {
  return new RegExp(`[${sep}"\n\r]`).test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Formato regional: pt usa ";" e vírgula decimal; en usa "," e ponto. */
function formatoRegional() {
  const en = idiomaAtual() === "en";
  return {
    sep: en ? "," : ";",
    valor: (v: number) => (en ? v.toFixed(2) : v.toFixed(2).replace(".", ",")),
  };
}

export function gerarCsv(movimentos: MovimentoCsv[]): string {
  const { sep, valor } = formatoRegional();
  const linhas = [
    i18n.t("csv.cabecalho"),
    ...[...movimentos]
      .sort((a, b) => a.data.getTime() - b.data.getTime())
      .map((m) =>
        [
          dataISO(m.data),
          i18n.t(`csv.${m.tipo}`),
          campo(m.descricao, sep),
          campo(m.contraparte, sep),
          m.estado,
          valor(m.valor),
        ].join(sep),
      ),
  ];
  // BOM para o Excel reconhecer UTF-8; CRLF por compatibilidade.
  return "\uFEFF" + linhas.join("\r\n") + "\r\n";
}

/** Gera e grava o CSV. Devolve o nome do ficheiro, ou null se cancelado. */
export async function exportarFinanceiroCsv(
  movimentos: MovimentoCsv[],
  inicio: Date,
  fim: Date,
): Promise<string | null> {
  const csv = gerarCsv(movimentos);
  const nome = `financeiro-${dataISO(inicio)}-a-${dataISO(fim)}.csv`;

  if (emTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const caminho = await save({
      defaultPath: nome,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (!caminho) return null;
    await writeTextFile(caminho, csv);
    return nome;
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
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
