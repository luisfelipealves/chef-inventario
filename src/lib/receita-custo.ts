import type { Ingrediente, IngredienteReceita, Receita } from "@/lib/db";

/** NaN significa custo desconhecido; formatEuro apresenta-o como “—”.
 * Nunca persistir estes resultados: são estimativas calculadas a partir dos dados atuais.
 */
export function custoLinha(
  linha: IngredienteReceita,
  ingrediente: Ingrediente | undefined,
): number {
  if (
    !ingrediente ||
    !Number.isFinite(ingrediente.precoEmbalagem) ||
    ingrediente.precoEmbalagem < 0 ||
    !Number.isFinite(ingrediente.quantidadeEmbalagem) ||
    ingrediente.quantidadeEmbalagem <= 0 ||
    !Number.isFinite(linha.quantidade) ||
    linha.quantidade <= 0
  )
    return NaN;
  return (ingrediente.precoEmbalagem / ingrediente.quantidadeEmbalagem) * linha.quantidade;
}

export function custoTotalReceita(
  receita: Pick<Receita, "ingredientes">,
  ingredientesMap: Map<number, Ingrediente>,
): number {
  if (!receita.ingredientes.length) return NaN;
  return receita.ingredientes.reduce(
    (acc, l) => acc + custoLinha(l, ingredientesMap.get(l.ingredienteId)),
    0,
  );
}

export function custoPorDose(total: number, rendimento: number): number {
  if (!Number.isFinite(total) || total < 0 || !Number.isFinite(rendimento) || rendimento <= 0)
    return NaN;
  return total / rendimento;
}

/** precoVenda é sempre o preço da receita completa, incluindo nos dados existentes. */
export function precoVendaPorUnidade(receita: Pick<Receita, "precoVenda" | "rendimento">): number {
  return custoPorDose(receita.precoVenda ?? NaN, receita.rendimento);
}

export function indicadoresVenda(custo: number, venda: number) {
  const resultado =
    Number.isFinite(custo) && custo >= 0 && Number.isFinite(venda) && venda >= 0
      ? venda - custo
      : NaN;
  return {
    resultado,
    margem: Number.isFinite(resultado) && venda > 0 ? (resultado / venda) * 100 : null,
    acrescimo: Number.isFinite(resultado) && custo > 0 ? (resultado / custo) * 100 : null,
  };
}

export function resumoReceita(
  receita: Pick<Receita, "ingredientes" | "rendimento" | "precoVenda">,
  ingredientesMap: Map<number, Ingrediente>,
) {
  const custoTotal = custoTotalReceita(receita, ingredientesMap);
  const custoDose = custoPorDose(custoTotal, receita.rendimento);
  const completo = Number.isFinite(custoDose);
  return {
    custoTotal,
    custoDose,
    completo,
    precoUnitario: precoVendaPorUnidade(receita),
    ...indicadoresVenda(completo ? custoTotal : NaN, receita.precoVenda ?? NaN),
  };
}
