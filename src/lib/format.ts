import { type UnidadeMedida } from "@/lib/db";

/**
 * Formata um valor em Euros com precisão dinâmica (até 4 casas decimais
 * quando o valor é muito pequeno, ex: preço por grama).
 */
export function formatEuro(value: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(value)) return "—";
  const digits = value !== 0 && Math.abs(value) < 0.1 ? 4 : 2;
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: opts?.compact ? 2 : digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function unidadeLabel(u: UnidadeMedida): string {
  return u;
}

/**
 * "1 g", "1 ml", "1 un" — a unidade mínima a que o custo unitário se refere.
 */
export function unidadeMinimaLabel(u: UnidadeMedida): string {
  return `1 ${u}`;
}

export function custoPorUnidade(precoEmbalagem: number, quantidadeEmbalagem: number): number {
  if (!quantidadeEmbalagem || quantidadeEmbalagem <= 0) return 0;
  return precoEmbalagem / quantidadeEmbalagem;
}
