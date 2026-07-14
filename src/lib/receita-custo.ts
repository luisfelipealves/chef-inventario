import type { Ingrediente, IngredienteReceita, Receita } from "@/lib/db";
import { custoPorUnidade } from "@/lib/format";

/**
 * Custo de uma linha de receita.
 * A quantidade da receita está expressa na mesma unidade do ingrediente.
 */
export function custoLinha(
  linha: IngredienteReceita,
  ingrediente: Ingrediente | undefined,
): number {
  if (!ingrediente) return 0;
  const unit = custoPorUnidade(
    ingrediente.precoEmbalagem,
    ingrediente.quantidadeEmbalagem,
  );
  return unit * linha.quantidade;
}

export function custoTotalReceita(
  receita: Pick<Receita, "ingredientes">,
  ingredientesMap: Map<number, Ingrediente>,
): number {
  return receita.ingredientes.reduce(
    (acc, l) => acc + custoLinha(l, ingredientesMap.get(l.ingredienteId)),
    0,
  );
}

export function custoPorDose(total: number, rendimento: number): number {
  if (!rendimento || rendimento <= 0) return 0;
  return total / rendimento;
}
