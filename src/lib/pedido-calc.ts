import type { EstadoPedido, Ingrediente, ItemPedido, Receita } from "@/lib/db";
import { custoTotalReceita, custoPorDose, indicadoresVenda } from "@/lib/receita-custo";

/** Custo dos ingredientes por unidade de rendimento. */
export function custoDoseReceita(
  receita: Receita | undefined,
  ingredientesMap: Map<number, Ingrediente>,
): number {
  if (!receita) return NaN;
  return custoPorDose(custoTotalReceita(receita, ingredientesMap), receita.rendimento);
}

export function totaisPedido(
  itens: ItemPedido[],
  receitasMap: Map<number, Receita>,
  ingredientesMap: Map<number, Ingrediente>,
) {
  let custo = 0;
  let venda = 0;
  for (const item of itens) {
    const quantidade =
      Number.isFinite(item.quantidade) && item.quantidade > 0 ? item.quantidade : NaN;
    const preco =
      Number.isFinite(item.precoUnitario) && item.precoUnitario >= 0 ? item.precoUnitario : NaN;
    custo += custoDoseReceita(receitasMap.get(item.receitaId), ingredientesMap) * quantidade;
    venda += preco * quantidade;
  }
  const { resultado: lucro, margem, acrescimo } = indicadoresVenda(custo, venda);
  return { custo, venda, lucro, margem, acrescimo, completo: Number.isFinite(custo) };
}

export const estadoLabel: Record<EstadoPedido, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};
