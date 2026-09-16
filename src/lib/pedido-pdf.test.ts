import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "./i18n";
import { exportarPedidoPdf } from "./pedido-pdf";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function instalarDownload() {
  const anchor = {
    href: "",
    download: "",
    click: vi.fn(),
    remove: vi.fn(),
  };
  vi.stubGlobal("document", {
    createElement: vi.fn().mockReturnValue(anchor),
    body: { appendChild: vi.fn() },
  });
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn().mockReturnValue("blob:pdf"),
    revokeObjectURL: vi.fn(),
  });
  return anchor;
}

describe("exportarPedidoPdf no browser", () => {
  it("exporta um orçamento com slug seguro e dispara o download", async () => {
    await i18n.changeLanguage("pt-PT");
    const anchor = instalarDownload();

    await expect(
      exportarPedidoPdf({
        tipo: "orcamento",
        pedido: {
          id: 42,
          clienteId: 1,
          itens: [{ receitaId: 7, quantidade: 2, precoUnitario: 3.5 }],
          dataEntrega: "2026-08-24",
          estado: "pendente",
          notas: "  Entregar depois das 18h.  ",
          createdAt: new Date("2026-08-20T10:00:00Z"),
        },
        cliente: {
          id: 1,
          nome: "João & Filhos / Lisboa",
          telefone: "",
          endereco: "",
          nif: "",
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
        receitaMap: new Map([
          [
            7,
            {
              id: 7,
              nome: "Bolo",
              rendimento: 1,
              unidadeRendimento: "un",
              ingredientes: [],
              createdAt: new Date(),
            },
          ],
        ]),
      }),
    ).resolves.toBe("orcamento-joao-filhos-lisboa-42.pdf");
    expect(anchor.download).toBe("orcamento-joao-filhos-lisboa-42.pdf");
    expect(anchor.href).toBe("blob:pdf");
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
  });

  it("usa fallbacks para cliente e receita removidos", async () => {
    await i18n.changeLanguage("pt-PT");
    const anchor = instalarDownload();

    await expect(
      exportarPedidoPdf({
        tipo: "pedido",
        pedido: {
          id: 43,
          clienteId: 99,
          itens: [{ receitaId: 999, quantidade: 1, precoUnitario: 2 }],
          dataEntrega: "2026-08-24",
          estado: "confirmado",
          notas: "",
          createdAt: new Date(),
        },
        receitaMap: new Map(),
      }),
    ).resolves.toBe("pedido-cliente-43.pdf");
    expect(anchor.click).toHaveBeenCalledOnce();
  });
});
