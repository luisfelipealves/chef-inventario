import type { Producao } from "./db";

/** Mantém a lista original intacta e apresenta o movimento mais recente primeiro. */
export function ordenarProducoesMaisRecentes(producoes: Producao[]): Producao[] {
  return [...producoes].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id,
  );
}
