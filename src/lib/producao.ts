import { db, stockDe, type Pedido, type Receita, type EstadoPedido } from "./db";
import { positivo, naoNegativo } from "./operacional";

export interface FaltaIngrediente {
  nome: string;
  falta: number;
  unidade: string;
}
export interface FaltaEntrega {
  receita: Receita;
  dosesNecessarias: number;
  faltam: number;
}
const tabelas = () => [db.ingredientes, db.receitas, db.producoes, db.pedidos, db.clientes];

/** Estoque insuficiente bloqueia a operação inteira, sem apagar déficits. */
export async function registarProducao(
  receita: Receita,
  lotes: number,
): Promise<FaltaIngrediente[]> {
  return db.transaction("rw", tabelas(), async () => {
    positivo(lotes, "Lotes");
    if (!Number.isInteger(lotes)) throw new Error("Informe lotes inteiros.");
    const atual = await db.receitas.get(receita.id);
    if (!atual) throw new Error("Receita inexistente.");
    positivo(atual.rendimento, "Rendimento");
    if (!atual.ingredientes.length) throw new Error("A receita não tem ingredientes.");
    for (const linha of atual.ingredientes) {
      const ing = await db.ingredientes.get(linha.ingredienteId);
      if (!ing) throw new Error("Ingrediente da receita inexistente.");
      const necessario = positivo(positivo(linha.quantidade, "Quantidade") * lotes, "Consumo");
      const stock = naoNegativo(stockDe(ing), "Estoque");
      if (stock < necessario)
        throw new Error(`Estoque insuficiente: ${ing.nome}. Reponha a despensa antes de produzir.`);
      await db.ingredientes.update(ing.id, { stock: stock - necessario });
    }
    const doses = positivo(lotes * atual.rendimento, "Doses");
    await db.producoes.add({
      receitaId: atual.id,
      nome: atual.nome,
      lotes,
      doses,
      createdAt: new Date(),
    });
    await db.receitas.update(atual.id, {
      dosesProntas: naoNegativo(
        naoNegativo(atual.dosesProntas ?? 0, "Doses prontas") + doses,
        "Doses finais",
      ),
    });
    return [];
  });
}
function dosesPorReceita(pedido: Pedido) {
  if (!pedido.itens.length) throw new Error("Adicione itens ao pedido.");
  const mapa = new Map<number, number>();
  for (const item of pedido.itens) {
    positivo(item.quantidade, "Quantidade do pedido");
    naoNegativo(item.precoUnitario, "Preço do pedido");
    mapa.set(item.receitaId, positivo((mapa.get(item.receitaId) ?? 0) + item.quantidade, "Doses"));
  }
  return mapa;
}
export async function faltasParaEntrega(pedido: Pedido): Promise<FaltaEntrega[]> {
  const faltas: FaltaEntrega[] = [];
  for (const [id, doses] of dosesPorReceita(pedido)) {
    const receita = await db.receitas.get(id);
    if (!receita) throw new Error("Receita do pedido inexistente.");
    const faltam = doses - naoNegativo(receita.dosesProntas ?? 0, "Doses prontas");
    if (faltam > 0) faltas.push({ receita, dosesNecessarias: doses, faltam });
  }
  return faltas;
}
export async function entregarPedido(
  pedido: Pedido,
  opts: { produzirFaltas: boolean },
): Promise<string[]> {
  return db.transaction("rw", tabelas(), async () => {
    const atual = await db.pedidos.get(pedido.id);
    if (!atual) throw new Error("Pedido inexistente.");
    if (atual.estado === "entregue") return [];
    if (atual.estado === "cancelado")
      throw new Error("Reabra o pedido cancelado antes de entregar.");
    const faltas = await faltasParaEntrega(atual);
    if (faltas.length && !opts.produzirFaltas)
      throw new Error("Doses insuficientes. Produza antes de entregar.");
    for (const f of faltas)
      await registarProducao(
        f.receita,
        Math.ceil(f.faltam / positivo(f.receita.rendimento, "Rendimento")),
      );
    const baixas = [...dosesPorReceita(atual)].map(([receitaId, quantidade]) => ({
      receitaId,
      quantidade,
    }));
    for (const baixa of baixas) {
      const receita = (await db.receitas.get(baixa.receitaId))!;
      const saldo = naoNegativo((receita.dosesProntas ?? 0) - baixa.quantidade, "Doses finais");
      await db.receitas.update(receita.id, { dosesProntas: saldo });
    }
    await db.pedidos.update(atual.id, {
      estado: "entregue",
      baixaEntrega: baixas,
      movimentosEntrega: [
        ...(atual.movimentosEntrega ?? []),
        { tipo: "entrega", baixas, createdAt: new Date() },
      ],
    });
    return [];
  });
}
/** Repor apenas doses efetivamente baixadas; produção permanece no histórico. */
export async function mudarEstadoPedido(id: number, estado: EstadoPedido) {
  return db.transaction("rw", tabelas(), async () => {
    const atual = await db.pedidos.get(id);
    if (!atual) throw new Error("Pedido inexistente.");
    if (estado === atual.estado) return;
    if (estado === "entregue") {
      await entregarPedido(atual, { produzirFaltas: false });
      return;
    }
    if (atual.estado === "entregue") {
      if (!atual.baixaEntrega)
        throw new Error(
          "Entrega antiga sem registro de baixa: reversão automática indisponível. Preserve este pedido e confira o estoque manualmente.",
        );
      for (const baixa of atual.baixaEntrega) {
        const receita = await db.receitas.get(baixa.receitaId);
        if (!receita) throw new Error("Receita removida: não é possível repor as doses.");
        await db.receitas.update(receita.id, {
          dosesProntas: naoNegativo(
            naoNegativo(receita.dosesProntas ?? 0, "Doses prontas") +
              positivo(baixa.quantidade, "Reposição"),
            "Doses finais",
          ),
        });
      }
      await db.pedidos.update(id, {
        estado,
        baixaEntrega: undefined,
        movimentosEntrega: [
          ...(atual.movimentosEntrega ?? []),
          { tipo: "reversao", baixas: atual.baixaEntrega, createdAt: new Date() },
        ],
      });
    } else await db.pedidos.update(id, { estado });
  });
}
export async function guardarPedido(
  payload: Omit<Pedido, "id" | "createdAt" | "baixaEntrega" | "movimentosEntrega">,
  id?: number,
) {
  return db.transaction("rw", tabelas(), async () => {
    if (!["pendente", "confirmado", "entregue", "cancelado"].includes(payload.estado))
      throw new Error("Estado inválido.");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(payload.dataEntrega) ||
      !Number.isFinite(Date.parse(payload.dataEntrega))
    )
      throw new Error("Data de entrega inválida.");
    const anterior = id === undefined ? undefined : await db.pedidos.get(id);
    if (id !== undefined && !anterior) throw new Error("Pedido inexistente.");
    if (anterior?.estado === "entregue")
      throw new Error(
        "Reabra o pedido pelo seletor de estado antes de editar. As doses serão repostas.",
      );
    if (!(await db.clientes.get(payload.clienteId))) throw new Error("Cliente inexistente.");
    const novo = { ...payload, createdAt: anterior?.createdAt ?? new Date() };
    await faltasParaEntrega(novo as Pedido);
    const estado = payload.estado === "entregue" ? "confirmado" : payload.estado;
    if (id === undefined) id = await db.pedidos.add({ ...novo, estado });
    else await db.pedidos.update(id, { ...payload, estado });
    if (payload.estado === "entregue")
      await entregarPedido({ id } as Pedido, { produzirFaltas: false });
    return id;
  });
}
