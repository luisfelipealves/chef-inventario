import type { Receita } from "./db";

/** Receitas que têm pelo menos uma unidade pronta para vender. */
export function receitasProntas(receitas: Receita[]): Receita[] {
  return receitas.filter((receita) => (receita.dosesProntas ?? 0) > 0);
}
