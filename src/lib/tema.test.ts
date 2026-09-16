import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { definirTema, inicializarTema, temaAtual, TEMAS } from "./tema";

function storageStub(values = new Map<string, string>()) {
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

const root = {
  dataset: {} as Record<string, string>,
  classList: { toggle: vi.fn() },
};

beforeEach(() => {
  vi.stubGlobal("localStorage", storageStub());
  vi.stubGlobal("document", { documentElement: root });
  vi.stubGlobal("window", { matchMedia: vi.fn().mockReturnValue({ matches: false }) });
  root.dataset = {};
  root.classList.toggle.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("temas", () => {
  it("expõe as três paletas suportadas", () => {
    expect(TEMAS.map((tema) => tema.id)).toEqual(["organic", "meia-noite", "morango"]);
  });

  it("prefere uma escolha válida guardada e ignora valores desconhecidos", () => {
    vi.stubGlobal("localStorage", storageStub(new Map([["chefgestao:tema", "morango"]])));
    expect(temaAtual()).toBe("morango");

    vi.stubGlobal("localStorage", storageStub(new Map([["chefgestao:tema", "inexistente"]])));
    expect(temaAtual()).toBe("organic");
  });

  it("segue o modo escuro do sistema quando não há escolha guardada", () => {
    vi.stubGlobal("window", { matchMedia: vi.fn().mockReturnValue({ matches: true }) });
    expect(temaAtual()).toBe("meia-noite");
  });

  it("persiste e aplica a classe dark apenas no tema meia-noite", () => {
    definirTema("meia-noite");
    expect(root.dataset.theme).toBe("meia-noite");
    expect(root.classList.toggle).toHaveBeenCalledWith("dark", true);

    definirTema("morango");
    expect(root.dataset.theme).toBe("morango");
    expect(root.classList.toggle).toHaveBeenLastCalledWith("dark", false);
  });

  it("inicializa o atributo a partir da preferência atual", () => {
    vi.stubGlobal("localStorage", storageStub(new Map([["chefgestao:tema", "morango"]])));
    inicializarTema();
    expect(root.dataset.theme).toBe("morango");
  });
});
