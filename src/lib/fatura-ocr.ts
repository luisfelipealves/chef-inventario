import type { UnidadeMedida } from "@/lib/db";

/**
 * Leitura de faturas de compras por visão (OCR + extração estruturada).
 *
 * Camada isolada do provedor — hoje usa o Google Gemini (o único com camada
 * gratuita de API com visão em Agosto 2026). Para trocar de provedor, só este
 * ficheiro precisa de mudar. Chave BYO (o utilizador cola a sua própria chave
 * gratuita), guardada localmente — nada sai do dispositivo além da imagem
 * enviada ao Gemini no momento da leitura.
 */

export interface ItemFatura {
  nome: string;
  quantidade: number;
  unidade: UnidadeMedida;
  precoTotal: number;
}

const KEY_STORAGE = "chefgestao:gemini-key";
const MODELO = "gemini-2.5-flash";

/**
 * Chave a usar. Preferência: a chave embutida no build (`VITE_GEMINI_KEY`,
 * definida num `.env` fora do git) — assim o utilizador final não lida com
 * chaves. Se não existir, cai na chave colada pelo utilizador (localStorage).
 */
export function getGeminiKey(): string {
  const embutida = (import.meta.env as Record<string, string | undefined>)
    .VITE_GEMINI_KEY;
  if (typeof embutida === "string" && embutida.trim()) return embutida.trim();
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(KEY_STORAGE) ?? "";
}

export function setGeminiKey(chave: string): void {
  try {
    localStorage.setItem(KEY_STORAGE, chave.trim());
  } catch {
    /* ignore */
  }
}

const UNIDADES: UnidadeMedida[] = ["g", "kg", "ml", "l", "un"];

function coerceUnidade(u: unknown): UnidadeMedida {
  const s = String(u ?? "")
    .toLowerCase()
    .trim();
  return (UNIDADES as string[]).includes(s) ? (s as UnidadeMedida) : "un";
}

const PROMPT = `És um assistente que lê faturas/talões de compras de supermercado em português.
Extrai cada linha de PRODUTO comprado. Para cada produto devolve:
- nome: o nome do produto, limpo e legível
- quantidade: a quantidade total comprada (número)
- unidade: uma de "g", "kg", "ml", "l", "un"
- precoTotal: o preço total pago por essa linha, em euros (número, ponto decimal)

Regras:
- Ignora totais, subtotais, IVA, descontos globais, número de contribuinte e cabeçalhos.
- Se a linha indicar peso (ex.: 0,450 kg) usa essa quantidade e unidade; senão usa "un" e a quantidade de unidades.
- Responde apenas com o JSON pedido, sem texto extra.`;

// Schema no formato do Gemini (tipos em MAIÚSCULAS).
const SCHEMA = {
  type: "OBJECT",
  properties: {
    itens: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nome: { type: "STRING" },
          quantidade: { type: "NUMBER" },
          unidade: { type: "STRING", enum: ["g", "kg", "ml", "l", "un"] },
          precoTotal: { type: "NUMBER" },
        },
        required: ["nome", "quantidade", "unidade", "precoTotal"],
      },
    },
  },
  required: ["itens"],
};

/**
 * Envia a imagem (base64 JPEG, sem prefixo data:) ao Gemini e devolve os itens.
 * Lança erro com mensagem legível em caso de falha.
 */
export async function lerFatura(imagemBase64: string, apiKey: string): Promise<ItemFatura[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [
      {
        parts: [{ inline_data: { mime_type: "image/jpeg", data: imagemBase64 } }, { text: PROMPT }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Sem ligação à internet. A leitura de faturas precisa de rede.");
  }

  if (res.status === 400 || res.status === 403) {
    throw new Error("Chave da API inválida ou sem acesso. Verifica a chave do Gemini.");
  }
  if (res.status === 429) {
    throw new Error("Limite gratuito atingido por agora. Tenta novamente mais tarde.");
  }
  if (!res.ok) {
    throw new Error(`Erro do Gemini (${res.status}). Tenta novamente.`);
  }

  const data = await res.json();
  const texto: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texto) throw new Error("Não foi possível ler a fatura. Tenta outra foto.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(texto);
  } catch {
    throw new Error("Resposta inesperada do Gemini. Tenta outra foto.");
  }

  const itens = (parsed as { itens?: unknown[] })?.itens;
  if (!Array.isArray(itens)) return [];

  return itens
    .map((raw): ItemFatura | null => {
      const o = raw as Record<string, unknown>;
      const nome = String(o.nome ?? "").trim();
      const quantidade = Number(o.quantidade);
      const precoTotal = Number(o.precoTotal);
      if (!nome || !Number.isFinite(quantidade) || quantidade <= 0) return null;
      return {
        nome,
        quantidade,
        unidade: coerceUnidade(o.unidade),
        precoTotal: Number.isFinite(precoTotal) ? precoTotal : 0,
      };
    })
    .filter((x): x is ItemFatura => x != null);
}
