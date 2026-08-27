import { describe, expect, it } from "vitest";
import type { Ingrediente, Pedido, Receita } from "@/lib/db";
import { calcularAlertasStock } from "@/lib/stock-alerta";

const HOJE = new Date(2026, 7, 23); // 23 ago 2026

function ing(id: number, stock: number): Ingrediente {
  return {
    id,
    nome: `Ingrediente ${id}`,
    unidade: "g",
    // Embalagem de referência deliberadamente diferente do stock: o alerta
    // olha para a despensa, não para o tamanho da embalagem.
    quantidadeEmbalagem: 250,
    precoEmbalagem: 1,
    stock,
    createdAt: HOJE,
  };
}

/** Registo anterior à v7: sem `stock`, o valor vivia em `quantidadeEmbalagem`. */
function ingLegado(id: number, stock: number): Ingrediente {
  return {
    id,
    nome: `Ingrediente ${id}`,
    unidade: "g",
    quantidadeEmbalagem: stock,
    precoEmbalagem: 1,
    createdAt: HOJE,
  };
}

// Receita: 500 g do ingrediente 1 por 10 doses → 50 g/dose
const receita: Receita = {
  id: 1,
  nome: "Bolo",
  rendimento: 10,
  unidadeRendimento: "un",
  ingredientes: [{ ingredienteId: 1, quantidade: 500 }],
  createdAt: HOJE,
};

function pedido(estado: Pedido["estado"], dataEntrega: string, doses: number): Pedido {
  return {
    id: 1,
    clienteId: 1,
    itens: [{ receitaId: 1, quantidade: doses, precoUnitario: 2 }],
    dataEntrega,
    estado,
    notas: "",
    createdAt: HOJE,
  };
}

describe("calcularAlertasStock", () => {
  it("alerta quando a necessidade a 7 dias excede o stock", () => {
    // 20 doses × 50 g = 1000 g necessários; stock 800 g → falta 200 g
    const alertas = calcularAlertasStock(
      [ing(1, 800)],
      [receita],
      [pedido("confirmado", "2026-08-25", 20)],
      HOJE,
    );
    expect(alertas).toHaveLength(1);
    expect(alertas[0].necessidade).toBeCloseTo(1000);
    expect(alertas[0].falta).toBeCloseTo(200);
  });

  it("não alerta quando o stock chega", () => {
    const alertas = calcularAlertasStock(
      [ing(1, 1000)],
      [receita],
      [pedido("confirmado", "2026-08-25", 20)],
      HOJE,
    );
    expect(alertas).toHaveLength(0);
  });

  it("ignora pedidos entregues e cancelados", () => {
    const alertas = calcularAlertasStock(
      [ing(1, 100)],
      [receita],
      [pedido("entregue", "2026-08-25", 20), pedido("cancelado", "2026-08-25", 20)],
      HOJE,
    );
    expect(alertas).toHaveLength(0);
  });

  it("ignora entregas fora da janela de 7 dias", () => {
    const alertas = calcularAlertasStock(
      [ing(1, 100)],
      [receita],
      [pedido("confirmado", "2026-09-15", 20), pedido("confirmado", "2026-08-20", 20)],
      HOJE,
    );
    expect(alertas).toHaveLength(0);
  });

  it("ordena por falta decrescente", () => {
    const receita2: Receita = {
      ...receita,
      id: 2,
      ingredientes: [{ ingredienteId: 2, quantidade: 500 }],
    };
    const p: Pedido = {
      ...pedido("confirmado", "2026-08-25", 20),
      itens: [
        { receitaId: 1, quantidade: 20, precoUnitario: 2 }, // ing 1: precisa 1000
        { receitaId: 2, quantidade: 40, precoUnitario: 2 }, // ing 2: precisa 2000
      ],
    };
    const alertas = calcularAlertasStock(
      [ing(1, 900), ing(2, 100)],
      [receita, receita2],
      [p],
      HOJE,
    );
    expect(alertas.map((a) => a.ingrediente.id)).toEqual([2, 1]);
  });

  it("lê registos anteriores à v7, sem campo stock", () => {
    const alertas = calcularAlertasStock(
      [ingLegado(1, 800)],
      [receita],
      [pedido("confirmado", "2026-08-25", 20)],
      HOJE,
    );
    expect(alertas).toHaveLength(1);
    expect(alertas[0].stock).toBe(800);
    expect(alertas[0].falta).toBeCloseTo(200);
  });
});
