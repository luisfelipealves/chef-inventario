import "fake-indexeddb/auto";
import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import { converterQuantidade, registarCompras } from "./operacional";
import { entregarPedido, guardarPedido, mudarEstadoPedido, registarProducao } from "./producao";

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.ingredientes.add({
    id: 1,
    nome: "Farinha",
    unidade: "g",
    quantidadeEmbalagem: 1000,
    precoEmbalagem: 2,
    stock: 1000,
    createdAt: new Date(),
  });
  await db.receitas.add({
    id: 1,
    nome: "Bolo",
    rendimento: 4,
    unidadeRendimento: "un",
    ingredientes: [{ ingredienteId: 1, quantidade: 100 }],
    dosesProntas: 4,
    createdAt: new Date(),
  });
  await db.clientes.add({
    id: 1,
    nome: "Teste",
    telefone: "",
    endereco: "",
    nif: "",
    createdAt: new Date(),
  });
});
afterAll(() => db.delete());
const payload = () => ({
  clienteId: 1,
  itens: [{ receitaId: 1, quantidade: 3, precoUnitario: 2 }],
  estado: "confirmado" as const,
  dataEntrega: "2026-09-05",
  notas: "",
});
const compra = () => ({
  ingredienteId: 1,
  nome: "Farinha",
  quantidade: 1,
  unidade: "kg" as const,
  valor: 2,
});
const pedido = async () => (await db.pedidos.get(await guardarPedido(payload())))!;

describe("compras e conversões", () => {
  it("converte massa e volume nos dois sentidos sem inferir peso", () => {
    expect(converterQuantidade(1, "kg", "g")).toBe(1000);
    expect(converterQuantidade(500, "g", "kg")).toBe(0.5);
    expect(converterQuantidade(1, "l", "ml")).toBe(1000);
    expect(converterQuantidade(500, "ml", "l")).toBe(0.5);
    expect(() => converterQuantidade(1, "un", "g")).toThrow("Reveja");
    expect(() => converterQuantidade(1, "g", "ml")).toThrow();
  });
  it("acumula linhas e confirma a mesma importação uma única vez, inclusive concorrente", async () => {
    await Promise.all([
      registarCompras([compra(), compra()], "fatura-1"),
      registarCompras([compra(), compra()], "fatura-1"),
    ]);
    expect((await db.ingredientes.get(1))?.stock).toBe(3000);
    expect(await db.compras.count()).toBe(2);
    await registarCompras([compra()], "fatura-2");
    expect((await db.ingredientes.get(1))?.stock).toBe(4000);
  });
  it("reverte todas as linhas quando uma unidade é incompatível", async () => {
    await expect(registarCompras([compra(), { ...compra(), unidade: "un" }])).rejects.toThrow();
    expect((await db.ingredientes.get(1))?.stock).toBe(1000);
    expect(await db.compras.count()).toBe(0);
  });
  it("reverte estoque se gravar Compra falhar", async () => {
    const spy = vi.spyOn(db.compras, "add").mockRejectedValueOnce(new Error("falha de disco"));
    await expect(registarCompras([compra()])).rejects.toThrow("falha de disco");
    spy.mockRestore();
    expect((await db.ingredientes.get(1))?.stock).toBe(1000);
  });
  it.each([NaN, Infinity, 0, -1])("rejeita quantidade %s", async (quantidade) => {
    await expect(registarCompras([{ ...compra(), quantidade }])).rejects.toThrow();
  });
  it("reverte ingrediente novo e rejeita referências inexistentes", async () => {
    await expect(
      registarCompras([
        { ...compra(), ingredienteId: undefined },
        { ...compra(), ingredienteId: 999 },
      ]),
    ).rejects.toThrow();
    expect(await db.ingredientes.count()).toBe(1);
  });
});
describe("produção e pedidos", () => {
  it("relê o banco e impede entrega duplicada concorrente", async () => {
    const p = await pedido();
    await Promise.all([
      entregarPedido(p, { produzirFaltas: false }),
      entregarPedido(p, { produzirFaltas: true }),
    ]);
    expect((await db.receitas.get(1))?.dosesProntas).toBe(1);
    expect((await db.pedidos.get(p.id))?.movimentosEntrega).toHaveLength(1);
    await entregarPedido(p, { produzirFaltas: false });
    expect((await db.receitas.get(1))?.dosesProntas).toBe(1);
  });
  it("reabre, repõe uma vez e permite nova entrega rastreada", async () => {
    const p = await pedido();
    await entregarPedido(p, { produzirFaltas: false });
    await Promise.all([
      mudarEstadoPedido(p.id, "confirmado"),
      mudarEstadoPedido(p.id, "confirmado"),
    ]);
    expect((await db.receitas.get(1))?.dosesProntas).toBe(4);
    await entregarPedido(p, { produzirFaltas: false });
    expect((await db.pedidos.get(p.id))?.movimentosEntrega).toHaveLength(3);
    expect((await db.receitas.get(1))?.dosesProntas).toBe(1);
  });
  it("bloqueia edição entregue e reversão legada", async () => {
    const p = await pedido();
    await entregarPedido(p, { produzirFaltas: false });
    await expect(
      guardarPedido(
        { ...payload(), itens: [{ receitaId: 1, quantidade: 1, precoUnitario: 2 }] },
        p.id,
      ),
    ).rejects.toThrow("Reabra");
    await db.pedidos.update(p.id, { baixaEntrega: undefined });
    await expect(mudarEstadoPedido(p.id, "pendente")).rejects.toThrow("antiga");
    expect((await db.receitas.get(1))?.dosesProntas).toBe(1);
  });
  it("cria entregue com baixa e reverte criação se faltar estoque", async () => {
    await guardarPedido({ ...payload(), estado: "entregue" });
    expect((await db.receitas.get(1))?.dosesProntas).toBe(1);
    await expect(guardarPedido({ ...payload(), estado: "entregue" })).rejects.toThrow(
      "insuficientes",
    );
    expect(await db.pedidos.count()).toBe(1);
  });
  it("produção automática e entrega são revertidas se a gravação final falhar", async () => {
    const p = await pedido();
    await db.receitas.update(1, { dosesProntas: 0 });
    const spy = vi.spyOn(db.pedidos, "update").mockRejectedValueOnce(new Error("falha final"));
    await expect(entregarPedido(p, { produzirFaltas: true })).rejects.toThrow("falha final");
    spy.mockRestore();
    expect((await db.ingredientes.get(1))?.stock).toBe(1000);
    expect((await db.receitas.get(1))?.dosesProntas).toBe(0);
    expect(await db.producoes.count()).toBe(0);
    expect((await db.pedidos.get(p.id))?.estado).toBe("confirmado");
  });
  it("produz só lotes necessários e mantém produção após reversão", async () => {
    const p = await pedido();
    await db.receitas.update(1, { dosesProntas: 0 });
    await entregarPedido(p, { produzirFaltas: true });
    await mudarEstadoPedido(p.id, "cancelado");
    expect((await db.ingredientes.get(1))?.stock).toBe(900);
    expect((await db.receitas.get(1))?.dosesProntas).toBe(4);
    expect(await db.producoes.count()).toBe(1);
  });
  it("não perde déficit, inclusive ingrediente repetido", async () => {
    await db.receitas.update(1, {
      ingredientes: [
        { ingredienteId: 1, quantidade: 600 },
        { ingredienteId: 1, quantidade: 600 },
      ],
    });
    await expect(registarProducao((await db.receitas.get(1))!, 1)).rejects.toThrow("insuficiente");
    expect((await db.ingredientes.get(1))?.stock).toBe(1000);
    expect(await db.producoes.count()).toBe(0);
  });
  it("valida lotes, rendimento e referências", async () => {
    const r = (await db.receitas.get(1))!;
    for (const n of [0, -1, NaN, Infinity, 1.5])
      await expect(registarProducao(r, n)).rejects.toThrow();
    await db.receitas.update(1, { rendimento: 0 });
    await expect(registarProducao(r, 1)).rejects.toThrow("Rendimento");
    await db.receitas.update(1, {
      rendimento: 4,
      ingredientes: [{ ingredienteId: 999, quantidade: 1 }],
    });
    await expect(registarProducao(r, 1)).rejects.toThrow("inexistente");
    await expect(guardarPedido({ ...payload(), clienteId: 999 })).rejects.toThrow("Cliente");
    await expect(
      guardarPedido({ ...payload(), itens: [{ receitaId: 999, quantidade: 1, precoUnitario: 0 }] }),
    ).rejects.toThrow("Receita");
  });
});

it("edita após reabrir e entrega exatamente os novos itens", async () => {
  const p = await pedido();
  await entregarPedido(p, { produzirFaltas: false });
  await mudarEstadoPedido(p.id, "confirmado");
  await guardarPedido(
    {
      ...payload(),
      estado: "entregue",
      itens: [{ receitaId: 1, quantidade: 2, precoUnitario: 2 }],
    },
    p.id,
  );
  expect((await db.receitas.get(1))?.dosesProntas).toBe(2);
});
it("reverte edição com entrega inviável e rejeita valores de compra inválidos", async () => {
  const p = await pedido();
  await expect(
    guardarPedido(
      {
        ...payload(),
        estado: "entregue",
        itens: [{ receitaId: 1, quantidade: 5, precoUnitario: 2 }],
      },
      p.id,
    ),
  ).rejects.toThrow();
  expect((await db.pedidos.get(p.id))?.itens[0].quantidade).toBe(3);
  for (const valor of [NaN, Infinity, -1])
    await expect(registarCompras([{ ...compra(), valor }])).rejects.toThrow();
  expect(await db.compras.count()).toBe(0);
});
it("reversão falha atomicamente se uma receita foi removida", async () => {
  const p = await pedido();
  await entregarPedido(p, { produzirFaltas: false });
  await db.receitas.delete(1);
  await expect(mudarEstadoPedido(p.id, "confirmado")).rejects.toThrow("removida");
  expect((await db.pedidos.get(p.id))?.estado).toBe("entregue");
});
