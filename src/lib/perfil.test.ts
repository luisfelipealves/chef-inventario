import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  gravarLogoNegocio,
  gravarNome,
  gravarNomeNegocio,
  logoNegocioGuardado,
  nomeGuardado,
  nomeNegocioGuardado,
} from "./perfil";

function storageStub() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

beforeEach(() => vi.stubGlobal("localStorage", storageStub()));
afterEach(() => vi.unstubAllGlobals());

describe("perfil local", () => {
  it("normaliza espaços no nome do utilizador e conserva a distinção de vazio", () => {
    expect(nomeGuardado()).toBe("");
    gravarNome("  Ana  ");
    expect(nomeGuardado()).toBe("Ana");

    gravarNome("   ");
    expect(nomeGuardado()).toBe("");
  });

  it("grava e remove o nome do negócio quando fica vazio", () => {
    gravarNomeNegocio("  Doce & Salgado  ");
    expect(nomeNegocioGuardado()).toBe("Doce & Salgado");
    gravarNomeNegocio(" ");
    expect(nomeNegocioGuardado()).toBe("");
  });

  it("grava e lê o logótipo como data URL", () => {
    expect(gravarLogoNegocio("data:image/png;base64,abc")).toBe(true);
    expect(logoNegocioGuardado()).toBe("data:image/png;base64,abc");
    expect(gravarLogoNegocio("")).toBe(true);
    expect(logoNegocioGuardado()).toBe("");
  });

  it("não propaga falhas de quota do localStorage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => undefined,
    });

    expect(() => gravarNome("Ana")).not.toThrow();
    expect(() => gravarNomeNegocio("Negócio")).not.toThrow();
    expect(gravarLogoNegocio("imagem")).toBe(false);
  });
});
