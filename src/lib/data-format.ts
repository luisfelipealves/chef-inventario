/** Helpers de data para as vistas de lista/detalhe (pt-PT). */

const MESES_CURTOS = new Intl.DateTimeFormat("pt-PT", { month: "short" });

export function parseData(s: string): Date | null {
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "24 ago" — dia + mês abreviado. */
export function dataEntregaCurta(s: string): string {
  const d = parseData(s);
  if (!d) return "—";
  return `${d.getDate()} ${MESES_CURTOS.format(d).replace(".", "")}`;
}

/** "segunda, 24 ago" — dia da semana (sem "-feira") + data curta. */
export function dataEntregaLonga(s: string): string {
  const d = parseData(s);
  if (!d) return "—";
  const semana = new Intl.DateTimeFormat("pt-PT", { weekday: "long" })
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
