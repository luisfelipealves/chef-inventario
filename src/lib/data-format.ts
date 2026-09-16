/** Helpers de data para as vistas de lista/detalhe (segue o idioma da UI). */
import { localeAtual } from "@/lib/i18n";

export function parseData(s: string): Date | null {
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "24 ago" — dia + mês abreviado. */
export function dataEntregaCurta(s: string): string {
  const d = parseData(s);
  if (!d) return "—";
  const mes = new Intl.DateTimeFormat(localeAtual(), { month: "short" }).format(d).replace(".", "");
  return `${d.getDate()} ${mes}`;
}

/** "segunda, 24 ago" — dia da semana (sem "-feira") + data curta. */
export function dataEntregaLonga(s: string): string {
  const d = parseData(s);
  if (!d) return "—";
  const semana = new Intl.DateTimeFormat(localeAtual(), { weekday: "long" })
    .format(d)
    .replace("-feira", "");
  return `${semana}, ${dataEntregaCurta(s)}`;
}

/** "24 ago 2026" — data curta com ano. */
export function dataComAno(s: string): string {
  const d = parseData(s);
  if (!d) return "—";
  return `${dataEntregaCurta(s)} ${d.getFullYear()}`;
}

/** "24/08/2026, 15:30" — data e hora de um movimento registado. */
export function dataHora(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(localeAtual(), {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}
