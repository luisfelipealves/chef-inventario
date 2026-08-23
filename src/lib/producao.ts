import { db, type Pedido, type Producao, type Receita } from "@/lib/db";
import i18n from "@/lib/i18n";

/**
 * Produção e entrega — a ponte entre receitas e a despensa.
 *
 * Registar uma produção abate os ingredientes na despensa (nunca abaixo de
 * zero) e soma doses prontas à receita. Entregar um pedido abate as doses
 * prontas vendidas. Voltar atrás num estado não repõe nada — o histórico de
 * produções fica na tabela `producoes`.
 */

export interface FaltaIngrediente {
  nome: string;
  falta: number;
  unidade: string;
}

/**
 * Regista `lotes` produções da receita: abate os ingredientes e soma as
 * doses prontas. Devolve os ingredientes cuja despensa não chegou (ficaram
 * a zero e ainda faltava esta quantidade).
 */
export async function registarProducao(
  receita: Receita,
  lotes: number,
): Promise<FaltaIngrediente[]> {
  const faltas: FaltaIngrediente[] = [];
  await db.transaction("rw", [db.ingredientes, db.receitas, db.producoes], async () => {
    for (const linha of receita.ingredientes) {
      const ing = await db.ingredientes.get(linha.ingredienteId);
      if (!ing) continue;
      const necessario = linha.quantidade * lotes;
      const restante = ing.quantidadeEmbalagem - necessario;
      if (restante < 0) {
        faltas.push({ nome: ing.nome, falta: -restante, unidade: ing.unidade });
      }
      await db.ingredientes.update(ing.id, {
        quantidadeEmbalagem: Math.max(0, restante),
      });
    }
    const doses = lotes * receita.rendimento;
    await db.producoes.add({
      receitaId: receita.id,
      nome: receita.nome,
      lotes,
      doses,
      createdAt: new Date(),
    } as Producao);
    const atual = await db.receitas.get(receita.id);
    await db.receitas.update(receita.id, {
      dosesProntas: (atual?.dosesProntas ?? 0) + doses,
    });
  });
  return faltas;
}

export interface FaltaEntrega {
  receita: Receita;
  dosesNecessarias: number;
  faltam: number;
}

/** Doses vendidas por receita num pedido (agrega itens repetidos). */
function dosesPorReceita(pedido: Pedido): Map<number, number> {
  const mapa = new Map<number, number>();
  for (const item of pedido.itens) {
    mapa.set(item.receitaId, (mapa.get(item.receitaId) ?? 0) + item.quantidade);
  }
  return mapa;
}

/** Receitas do pedido sem doses prontas suficientes para a entrega. */
export async function faltasParaEntrega(pedido: Pedido): Promise<FaltaEntrega[]> {
  const faltas: FaltaEntrega[] = [];
  for (const [receitaId, doses] of dosesPorReceita(pedido)) {
    const receita = await db.receitas.get(receitaId);
    if (!receita) continue;
    const faltam = doses - (receita.dosesProntas ?? 0);
    if (faltam > 0) faltas.push({ receita, dosesNecessarias: doses, faltam });
  }
  return faltas;
}

/**
 * Marca o pedido como entregue e abate as doses prontas vendidas.
 * Com `produzirFaltas`, regista antes a produção em falta (em lotes
 * inteiros — faz-se o bolo todo, não a fatia). Devolve avisos legíveis
 * (despensa curta, doses insuficientes) para mostrar ao utilizador.
 */
export async function entregarPedido(
  pedido: Pedido,
  opts: { produzirFaltas: boolean },
): Promise<string[]> {
  const avisos: string[] = [];

  if (opts.produzirFaltas) {
    for (const f of await faltasParaEntrega(pedido)) {
      const lotes = Math.ceil(f.faltam / Math.max(1, f.receita.rendimento));
      const faltasIng = await registarProducao(f.receita, lotes);
      for (const fi of faltasIng) {
        avisos.push(
          i18n.t("producao.avisoDespensa", {
            nome: fi.nome,
            qtd: arredonda(fi.falta),
            unidade: fi.unidade,
          }),
        );
      }
    }
  }

  await db.transaction("rw", [db.receitas, db.pedidos], async () => {
    for (const [receitaId, doses] of dosesPorReceita(pedido)) {
      const receita = await db.receitas.get(receitaId);
      if (!receita) continue;
      const prontas = receita.dosesProntas ?? 0;
      if (doses > prontas) {
        avisos.push(i18n.t("producao.avisoDoses", { nome: receita.nome, doses, prontas }));
      }
      await db.receitas.update(receitaId, { dosesProntas: Math.max(0, prontas - doses) });
    }
    await db.pedidos.update(pedido.id, { estado: "entregue" });
  });

  return avisos;
}

function arredonda(v: number): number {
  return Math.round(v * 100) / 100;
}
