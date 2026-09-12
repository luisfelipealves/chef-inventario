import { describe, expect, it } from "vitest";
import type { Ingrediente, Receita } from "./db";
import { custoLinha, indicadoresVenda, precoVendaPorUnidade, resumoReceita } from "./receita-custo";
import { totaisPedido } from "./pedido-calc";
import { formatEuro } from "./format";

const ingrediente: Ingrediente = {
  id: 1,
  nome: "Farinha",
  unidade: "g",
  quantidadeEmbalagem: 1000,
  precoEmbalagem: 10,
  stock: 0,
  createdAt: new Date(),
};
const receita: Receita = {
  id: 1,
  nome: "Salgados",
  ingredientes: [{ ingredienteId: 1, quantidade: 1000 }],
  rendimento: 10,
  unidadeRendimento: "un",
  precoVenda: 20,
  createdAt: new Date(),
};
const ingredientes = new Map([[1, ingrediente]]);

describe("fase 1: custo, venda e indicadores consistentes", () => {
  it("10 € de ingredientes, 10 unidades e venda de 20 €: custo 1 €, venda 2 €, margem 50%, acréscimo 100%", () => {
    const ficha = resumoReceita(receita, ingredientes);
    const pedido = totaisPedido(
      [{ receitaId: 1, quantidade: 10, precoUnitario: precoVendaPorUnidade(receita) }],
      new Map([[1, receita]]),
      ingredientes,
    );
    expect(ficha).toMatchObject({
      custoTotal: 10,
      custoDose: 1,
      precoUnitario: 2,
      resultado: 10,
      margem: 50,
      acrescimo: 100,
      completo: true,
    });
    expect(pedido).toMatchObject({
      custo: 10,
      venda: 20,
      lucro: 10,
      margem: ficha.margem,
      acrescimo: ficha.acrescimo,
      completo: true,
    });
  });
  it("mantém a percentagem em encomendas parciais e de vários lotes", () => {
    for (const quantidade of [1, 5, 20]) {
      const pedido = totaisPedido(
        [{ receitaId: 1, quantidade, precoUnitario: 2 }],
        new Map([[1, receita]]),
        ingredientes,
      );
      expect(pedido.custo).toBe(quantidade);
      expect(pedido.margem).toBe(50);
    }
  });
  it("mantém precisão no preço por unidade, incluindo venda por peso", () => {
    expect(precoVendaPorUnidade({ precoVenda: 1, rendimento: 3 })).toBe(1 / 3);
    const porPeso: Receita = { ...receita, unidadeRendimento: "g", rendimento: 1000 };
    expect(resumoReceita(porPeso, ingredientes).precoUnitario).toBe(0.02);
  });
  it("mostra resultado negativo para venda abaixo do custo", () => {
    expect(indicadoresVenda(10, 5)).toEqual({ resultado: -5, margem: -100, acrescimo: -50 });
  });
  it("distingue preço zero conhecido, ausência de venda e ausência de custo", () => {
    expect(indicadoresVenda(10, 0)).toEqual({ resultado: -10, margem: null, acrescimo: -100 });
    expect(indicadoresVenda(0, 10)).toEqual({ resultado: 10, margem: 100, acrescimo: null });
    expect(indicadoresVenda(0, 0)).toEqual({ resultado: 0, margem: null, acrescimo: null });
    const semVenda = resumoReceita({ ...receita, precoVenda: undefined }, ingredientes);
    expect(semVenda.completo).toBe(true);
    expect(semVenda.resultado).toBeNaN();
    expect(semVenda.margem).toBeNull();
  });
  it.each([undefined, NaN, Infinity, -1])(
    "não transforma preço inválido %s em custo zero",
    (precoEmbalagem) => {
      const mapa = new Map([[1, { ...ingrediente, precoEmbalagem: precoEmbalagem as number }]]);
      const ficha = resumoReceita(receita, mapa);
      expect(ficha.completo).toBe(false);
      expect(ficha.resultado).toBeNaN();
      expect(ficha.margem).toBeNull();
      expect(formatEuro(ficha.custoTotal)).toBe("—");
    },
  );
  it("preço de ingrediente explicitamente zero é válido", () => {
    expect(custoLinha(receita.ingredientes[0], { ...ingrediente, precoEmbalagem: 0 })).toBe(0);
  });
  it.each([0, -1, NaN, Infinity])(
    "não calcula indicadores com rendimento inválido %s",
    (rendimento) => {
      const ficha = resumoReceita({ ...receita, rendimento }, ingredientes);
      expect(ficha.completo).toBe(false);
      expect(ficha.margem).toBeNull();
      expect(ficha.precoUnitario).toBeNaN();
    },
  );
  it("uma receita incompleta invalida o custo agregado, preservando a venda", () => {
    const incompleta = { ...receita, id: 2, ingredientes: [{ ingredienteId: 99, quantidade: 10 }] };
    const totais = totaisPedido(
      [
        { receitaId: 1, quantidade: 1, precoUnitario: 2 },
        { receitaId: 2, quantidade: 1, precoUnitario: 3 },
      ],
      new Map([
        [1, receita],
        [2, incompleta],
      ]),
      ingredientes,
    );
    expect(totais.venda).toBe(5);
    expect(totais.custo).toBeNaN();
    expect(totais.lucro).toBeNaN();
    expect(totais.margem).toBeNull();
  });
  it("receita vazia e linha sem quantidade não aparentam custo completo", () => {
    expect(resumoReceita({ ...receita, ingredientes: [] }, ingredientes).completo).toBe(false);
    expect(
      resumoReceita(
        { ...receita, ingredientes: [{ ingredienteId: 1, quantidade: 0 }] },
        ingredientes,
      ).completo,
    ).toBe(false);
  });
});
