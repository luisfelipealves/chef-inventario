import type { UnidadeMedida } from "@/lib/db";

export type OffResult = {
  nome: string | null;
  quantidade: number | null;
  unidade: UnidadeMedida | null;
};

/**
 * Extrai número + unidade a partir de uma string como
 * "500 g", "1kg", "1,5 L", "250ml".
 */
export function parseQuantidade(raw: string | undefined | null): {
  quantidade: number | null;
  unidade: UnidadeMedida | null;
} {
  if (!raw) return { quantidade: null, unidade: null };
  const s = raw.toLowerCase().replace(",", ".").trim();
  const m = s.match(/([\d.]+)\s*(kg|g|l|ml|cl|un|unid|unidades?)/);
  if (!m) return { quantidade: null, unidade: null };
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return { quantidade: null, unidade: null };
  const u = m[2];
  if (u === "kg") return { quantidade: n, unidade: "kg" };
  if (u === "g") return { quantidade: n, unidade: "g" };
  if (u === "l") return { quantidade: n, unidade: "l" };
  if (u === "ml") return { quantidade: n, unidade: "ml" };
  if (u === "cl") return { quantidade: n * 10, unidade: "ml" };
  return { quantidade: n, unidade: "un" };
}

export async function fetchProdutoOFF(barcode: string): Promise<OffResult | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    barcode,
  )}.json?fields=product_name,product_name_pt,generic_name_pt,quantity`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status?: number;
    product?: {
      product_name?: string;
      product_name_pt?: string;
      generic_name_pt?: string;
      quantity?: string;
    };
  };
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  const nome =
    p.product_name_pt ||
    p.generic_name_pt ||
    p.product_name ||
    null;
  const { quantidade, unidade } = parseQuantidade(p.quantity);
  return { nome, quantidade, unidade };
}
