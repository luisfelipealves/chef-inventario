import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "./i18n";
import { getGeminiKey, getGeminiModel, lerFatura, setGeminiKey } from "./fatura-ocr";

afterEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage("pt-PT");
});

function resposta(itens: unknown[], status = 200): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ itens }) }] } }] }),
    { status },
  );
}

describe("configuração do OCR", () => {
  it("respeita a prioridade da chave embutida e mantém o modelo configurado", () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue("  chave-local  "),
      setItem: vi.fn(),
    });
    const env = import.meta.env as Record<string, string | undefined>;
    expect(getGeminiModel()).toBe(env.VITE_GEMINI_MODEL?.trim() || "gemini-3.6-flash");
    expect(getGeminiKey()).toBe(env.VITE_GEMINI_KEY?.trim() || "  chave-local  ");

    setGeminiKey("  nova-chave  ");
    expect(vi.mocked(localStorage.setItem)).toHaveBeenCalledWith(
      "chefgestao:gemini-key",
      "nova-chave",
    );
  });

  it("tolera a ausência de localStorage", () => {
    vi.stubGlobal("localStorage", undefined);
    const embedded = (import.meta.env as Record<string, string | undefined>).VITE_GEMINI_KEY;
    expect(getGeminiKey()).toBe(embedded?.trim() || "");
    expect(() => setGeminiKey("chave")).not.toThrow();
  });
});

describe("lerFatura", () => {
  it("identifica quando o modelo configurado está indisponível", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not found", { status: 404 })));

    await expect(lerFatura("imagem", "chave")).rejects.toThrow(
      i18n.t("ocr.modeloIndisponivel", { modelo: getGeminiModel() }),
    );
  });

  it.each([400, 403])("traduz uma chave rejeitada pelo provedor (%s)", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("invalid", { status })));
    await expect(lerFatura("imagem", "chave")).rejects.toThrow(i18n.t("ocr.chaveInvalida"));
  });

  it("distingue limite, falha HTTP genérica e falha de rede", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("busy", { status: 429 })));
    await expect(lerFatura("imagem", "chave")).rejects.toThrow(i18n.t("ocr.limite"));

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("error", { status: 500 })));
    await expect(lerFatura("imagem", "chave")).rejects.toThrow(
      i18n.t("ocr.erroGemini", { status: 500 }),
    );

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(lerFatura("imagem", "chave")).rejects.toThrow(i18n.t("ocr.semRede"));
  });

  it("limpa a resposta, aplica a unidade fallback e ignora itens inválidos", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          resposta([
            { nome: "  Farinha  ", quantidade: "2", unidade: "KG", precoTotal: "3.5" },
            { nome: "Sem quantidade", quantidade: 0, unidade: "g", precoTotal: 1 },
            { nome: "Preço ilegível", quantidade: 1, unidade: "g", precoTotal: "x" },
            null,
            "linha inválida",
          ]),
        ),
    );

    await expect(lerFatura("imagem", "chave")).resolves.toEqual([
      { nome: "Farinha", quantidade: 2, unidade: "kg", precoTotal: 3.5 },
      { nome: "Preço ilegível", quantidade: 1, unidade: "g", precoTotal: 0 },
    ]);
  });

  it("devolve vazio para JSON válido sem itens e traduz o prompt pelo idioma", async () => {
    const fetch = vi.fn().mockResolvedValue(resposta([]));
    vi.stubGlobal("fetch", fetch);
    await i18n.changeLanguage("en");
    await expect(lerFatura("imagem", "chave")).resolves.toEqual([]);
    const body = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(body.contents[0].parts[1].text).toContain("reads supermarket receipts");

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] })),
        ),
    );
    await expect(lerFatura("imagem", "chave")).resolves.toEqual([]);
  });

  it.each([
    ["sem texto", { candidates: [{ content: { parts: [{ text: "" }] } }] }, "ocr.naoLeu"],
    [
      "JSON inválido",
      { candidates: [{ content: { parts: [{ text: "não é json" }] } }] },
      "ocr.respostaInesperada",
    ],
  ] as const)("rejeita %s vindo do modelo", async (_, body, chave) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
    await expect(lerFatura("imagem", "chave")).rejects.toThrow(i18n.t(chave));
  });
});
