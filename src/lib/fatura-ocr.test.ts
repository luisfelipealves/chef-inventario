import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "./i18n";
import { getGeminiModel, lerFatura } from "./fatura-ocr";

afterEach(() => vi.restoreAllMocks());

describe("lerFatura", () => {
  it("identifica quando o modelo configurado está indisponível", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not found", { status: 404 })));

    await expect(lerFatura("imagem", "chave")).rejects.toThrow(
      i18n.t("ocr.modeloIndisponivel", { modelo: getGeminiModel() }),
    );
  });
});
