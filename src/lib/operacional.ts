import { db, stockDe, type UnidadeMedida } from "./db";

export function positivo(valor: number, campo: string): number {
  if (!Number.isFinite(valor) || valor <= 0)
    throw new Error(`${campo}: informe um valor finito e positivo.`);
  return valor;
}
export function naoNegativo(valor: number, campo: string): number {
  if (!Number.isFinite(valor) || valor < 0)
    throw new Error(`${campo}: informe um valor finito e não negativo.`);
  return valor;
}
export function converterQuantidade(
  valor: number,
  origem: UnidadeMedida,
  destino: UnidadeMedida,
): number {
  positivo(valor, "Quantidade");
  const unidades = {
    g: ["massa", 1],
    kg: ["massa", 1000],
    ml: ["volume", 1],
    l: ["volume", 1000],
    un: ["unidade", 1],
  } as const;
  const a = unidades[origem],
    b = unidades[destino];
  if (!a || !b || a[0] !== b[0])
    throw new Error(
      `Reveja a quantidade e a unidade: não é possível converter ${origem} para ${destino} sem informação da embalagem.`,
    );
  return positivo((valor * a[1]) / b[1], "Quantidade convertida");
}
export interface LinhaCompra {
  ingredienteId?: number;
  nome: string;
  quantidade: number;
  unidade: UnidadeMedida;
  valor: number;
  codigoBarras?: string;
}
/** Uma confirmação inteira é atômica; cada linha lê o estoque já atualizado. */
export async function registarCompras(linhas: LinhaCompra[], operacaoId?: string) {
  if (!linhas.length) throw new Error("Adicione pelo menos uma linha de compra.");
  return db.transaction("rw", [db.ingredientes, db.compras], async () => {
    if (operacaoId && (await db.compras.filter((c) => c.operacaoId === operacaoId).count())) return;
    for (const linha of linhas) {
      positivo(linha.quantidade, "Quantidade");
      naoNegativo(linha.valor, "Preço");
      let id = linha.ingredienteId;
      let quantidade = converterQuantidade(linha.quantidade, linha.unidade, linha.unidade);
      let nome = linha.nome.trim();
      let unidade = linha.unidade;
      if (id !== undefined) {
        const ing = await db.ingredientes.get(id);
        if (!ing) throw new Error("Ingrediente inexistente. Reveja a compra.");
        quantidade = converterQuantidade(quantidade, unidade, ing.unidade);
        unidade = ing.unidade;
        nome = ing.nome;
        await db.ingredientes.update(id, {
          stock: naoNegativo(naoNegativo(stockDe(ing), "Estoque") + quantidade, "Estoque final"),
          quantidadeEmbalagem: quantidade,
          precoEmbalagem: linha.valor,
          ...(linha.codigoBarras ? { codigoBarras: linha.codigoBarras } : {}),
        });
      } else {
        if (!nome) throw new Error("Informe o nome do ingrediente.");
        id = await db.ingredientes.add({
          nome,
          unidade,
          quantidadeEmbalagem: quantidade,
          precoEmbalagem: linha.valor,
          stock: quantidade,
          createdAt: new Date(),
        });
      }
      await db.compras.add({
        operacaoId,
        ingredienteId: id,
        nome,
        quantidade,
        unidade,
        valor: linha.valor,
        createdAt: new Date(),
      });
    }
  });
}

/** Remove um ingrediente apenas quando nenhuma receita ainda o utiliza. */
export async function eliminarIngrediente(id: number) {
  return db.transaction("rw", [db.ingredientes, db.receitas], async () => {
    const existe = await db.ingredientes.get(id);
    if (!existe) throw new Error("Ingrediente inexistente.");
    const dependente = await db.receitas
      .toCollection()
      .filter((receita) => receita.ingredientes.some((linha) => linha.ingredienteId === id))
      .first();
    if (dependente) throw new Error(`Ingrediente utilizado na receita “${dependente.nome}”.`);
    await db.ingredientes.delete(id);
  });
}

/** Remove uma receita apenas quando não há pedidos nem produções dependentes. */
export async function eliminarReceita(id: number) {
  return db.transaction("rw", [db.receitas, db.pedidos, db.producoes], async () => {
    const existe = await db.receitas.get(id);
    if (!existe) throw new Error("Receita inexistente.");
    const producao = await db.producoes.where("receitaId").equals(id).first();
    if (producao) throw new Error("Receita possui registos de produção.");
    const pedido = await db.pedidos
      .toCollection()
      .filter((p) => p.itens.some((item) => item.receitaId === id))
      .first();
    if (pedido) throw new Error("Receita utilizada num pedido.");
    await db.receitas.delete(id);
  });
}

/** Remove um cliente apenas quando não há pedidos associados. */
export async function eliminarCliente(id: number) {
  return db.transaction("rw", [db.clientes, db.pedidos], async () => {
    const existe = await db.clientes.get(id);
    if (!existe) throw new Error("Cliente inexistente.");
    const pedido = await db.pedidos.where("clienteId").equals(id).first();
    if (pedido) throw new Error("Cliente possui pedidos associados.");
    await db.clientes.delete(id);
  });
}
