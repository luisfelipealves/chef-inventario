import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchProdutoOFF, parseQuantidade } from "./open-food-facts";

afterEach(() => vi.unstubAllGlobals());

describe("parseQuantidade", () => {
  it.each([
    ["500 g", { quantidade: 500, unidade: "g" }],
    ["1kg", { quantidade: 1, unidade: "kg" }],
    ["1,5 L", { quantidade: 1.5, unidade: "l" }],
    ["250 ml", { quantidade: 250, unidade: "ml" }],
    ["10 cl", { quantidade: 100, unidade: "ml" }],
    ["6 unidades", { quantidade: 6, unidade: "un" }],
    ["2 unid", { quantidade: 2, unidade: "un" }],
  ] as const)("converte %s", (raw, esperado) => {
    expect(parseQuantidade(raw)).toEqual(esperado);
  });

  it.each([undefined, null, "", "tamanho familiar", "500 oz"])(
    "não inventa unidade para quantidade inválida: %s",
    (raw) => {
      expect(parseQuantidade(raw)).toEqual({ quantidade: null, unidade: null });
    },
  );

  it("aceita texto descritivo à volta da quantidade e usa a primeira medida", () => {
    expect(parseQuantidade("pack com 500g (aprox.)")).toEqual({ quantidade: 500, unidade: "g" });
  });
});

describe("fetchProdutoOFF", () => {
  it("prioriza nome em português, converte a quantidade e codifica o código", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 1,
          product: {
            product_name: "Generic name",
            product_name_pt: "Farinha fina",
            generic_name_pt: "Farinha",
            quantity: "1,5 kg",
          },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(fetchProdutoOFF("560 123/á")).resolves.toEqual({
      nome: "Farinha fina",
      quantidade: 1.5,
      unidade: "kg",
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/product/560%20123%2F%C3%A1.json?fields="),
    );
  });

  it("faz fallback do nome genérico para o nome geral", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 1,
            product: { product_name: "Milk", generic_name_pt: "Leite" },
          }),
        ),
      ),
    );

    await expect(fetchProdutoOFF("1")).resolves.toMatchObject({ nome: "Leite" });
  });

  it.each([
    new Response("not found", { status: 404 }),
    new Response(JSON.stringify({ status: 0 }), { status: 200 }),
    new Response(JSON.stringify({ status: 1 }), { status: 200 }),
  ])(
    "devolve null quando o produto não existe ou a resposta não é utilizável",
    async (response) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      await expect(fetchProdutoOFF("1")).resolves.toBeNull();
    },
  );
});
