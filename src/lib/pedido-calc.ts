import type { EstadoPedido, Ingrediente, ItemPedido, Receita } from "@/lib/db";
import { custoTotalReceita, custoPorDose } from "@/lib/receita-custo";

/** Custo de produção por dose de uma receita. */
export function custoDoseReceita(
  receita: Receita | undefined,
  ingredientesMap: Map<number, Ingrediente>,
): number {
  if (!receita) return 0;
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
    custo += custoDoseReceita(receitasMap.get(item.receitaId), ingredientesMap) * item.quantidade;
    venda += item.precoUnitario * item.quantidade;
  }
  const lucro = venda - custo;
  const margem = custo > 0 ? (lucro / custo) * 100 : 0;
  return { custo, venda, lucro, margem };
}

export const estadoLabel: Record<EstadoPedido, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};
