import type { Ingrediente, Pedido, Receita } from "@/lib/db";

/**
 * Alerta de stock baixo (única funcionalidade nova do layout desktop).
 *
 * Para cada ingrediente, soma a quantidade exigida pelos pedidos com estado
 * `pendente` ou `confirmado` cuja `dataEntrega` cai nos próximos 7 dias
 * (quantidade da receita × doses encomendadas, escalada pelo rendimento) e
 * compara com `quantidadeEmbalagem` (o stock disponível). Se a necessidade
 * exceder o stock, o ingrediente está em falta.
 *
 * Não requer alteração de esquema. Um limiar manual por ingrediente
 * (`stockMinimo`) poderia ser acrescentado numa futura `db.version(5)`.
 */

export interface AlertaStock {
  ingrediente: Ingrediente;
  /** Stock disponível (quantidadeEmbalagem), na unidade do ingrediente. */
  stock: number;
  /** Quantidade total exigida pelos pedidos confirmados/pendentes a 7 dias. */
  necessidade: number;
  /** necessidade − stock, sempre > 0 para um alerta. */
  falta: number;
}

const DIA_MS = 24 * 60 * 60 * 1000;
const JANELA_DIAS = 7;

function parseDataEntrega(s: string): Date | null {
  // dataEntrega é "YYYY-MM-DD" (input type=date).
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function calcularAlertasStock(
  ingredientes: Ingrediente[],
  receitas: Receita[],
  pedidos: Pedido[],
  hoje: Date = new Date(),
): AlertaStock[] {
  const receitaMap = new Map(receitas.map((r) => [r.id, r]));

  const inicio = new Date(hoje);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio.getTime() + JANELA_DIAS * DIA_MS);

  // Necessidade acumulada por ingredienteId.
  const necessidadePorIng = new Map<number, number>();
  for (const pedido of pedidos) {
    if (pedido.estado !== "pendente" && pedido.estado !== "confirmado") continue;
    const data = parseDataEntrega(pedido.dataEntrega);
    if (!data || data < inicio || data > fim) continue;

    for (const item of pedido.itens) {
      const receita = receitaMap.get(item.receitaId);
      if (!receita || receita.rendimento <= 0) continue;
      for (const linha of receita.ingredientes) {
        // A quantidade da receita produz `rendimento` doses; escala pela dose.
        const porDose = linha.quantidade / receita.rendimento;
        const total = porDose * item.quantidade;
        necessidadePorIng.set(
          linha.ingredienteId,
          (necessidadePorIng.get(linha.ingredienteId) ?? 0) + total,
        );
      }
    }
  }

  const alertas: AlertaStock[] = [];
  for (const ing of ingredientes) {
    const necessidade = necessidadePorIng.get(ing.id) ?? 0;
    if (necessidade > ing.quantidadeEmbalagem) {
      alertas.push({
        ingrediente: ing,
        stock: ing.quantidadeEmbalagem,
        necessidade,
        falta: necessidade - ing.quantidadeEmbalagem,
      });
    }
  }
  alertas.sort((a, b) => b.falta - a.falta);
  return alertas;
}

/** Mapa ingredienteId → alerta, para consulta rápida no detalhe/lista. */
export function mapaAlertas(alertas: AlertaStock[]): Map<number, AlertaStock> {
  return new Map(alertas.map((a) => [a.ingrediente.id, a]));
}
