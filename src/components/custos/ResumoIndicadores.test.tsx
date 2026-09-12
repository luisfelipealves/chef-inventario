import { beforeAll, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { AvisoCusto, ResumoIndicadores } from "./ResumoIndicadores";
import pt from "@/locales/pt-PT.json";
import en from "@/locales/en.json";

const i18n = createInstance();
beforeAll(async () => {
  await i18n.init({
    lng: "pt-PT",
    resources: { "pt-PT": { translation: pt }, en: { translation: en } },
    interpolation: { escapeValue: false },
  });
});
describe("apresentação dos indicadores partilhada por fichas e pedidos", () => {
  it("identifica as duas percentagens e o limite do resultado em português e inglês", async () => {
    for (const lng of ["pt-PT", "en"]) {
      await i18n.changeLanguage(lng);
      const html = renderToStaticMarkup(
        <I18nextProvider i18n={i18n}>
          <ResumoIndicadores resultado={10} margem={50} acrescimo={100} />
          <AvisoCusto completo />
        </I18nextProvider>,
      );
      expect(html).toContain(lng === "pt-PT" ? "Margem sobre a venda" : "Margin on sales");
      expect(html).toContain(lng === "pt-PT" ? "Acréscimo sobre o custo" : "Markup on cost");
      expect(html).toContain("50.0%");
      expect(html).toContain("100.0%");
      expect(html).toContain(lng === "pt-PT" ? "Inclui apenas ingredientes" : "Ingredients only");
    }
  });
  it("apresenta um aviso acessível em vez de NaN, zero ou lucro artificial", () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <ResumoIndicadores resultado={NaN} margem={null} acrescimo={null} />
        <AvisoCusto completo={false} />
      </I18nextProvider>,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("—");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("0.0%");
  });
});
