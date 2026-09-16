import { afterEach, describe, expect, it, vi } from "vitest";
import { gerarId } from "./id";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("gerarId", () => {
  it("usa randomUUID quando está disponível", () => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("uuid-fixo") });
    expect(gerarId()).toBe("uuid-fixo");
  });

  it("constrói um UUID v4 com getRandomValues em browsers antigos", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0);
        return bytes;
      },
    });

    const id = gerarId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("usa o fallback temporal quando crypto não existe", () => {
    vi.stubGlobal("crypto", undefined);
    vi.spyOn(Date, "now").mockReturnValue(123456);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(gerarId()).toBe("2n9c-i");
  });
});
