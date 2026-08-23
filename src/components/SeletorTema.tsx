import { useTranslation } from "react-i18next";
import { TEMAS, definirTema, useTema, type Tema } from "@/lib/tema";

/** Amostras de cor de cada tema (fundo + destaque), para o seletor. */
const AMOSTRA: Record<Tema, [string, string]> = {
  organic: ["#f5ead8", "#c67139"],
  "meia-noite": ["#1d1917", "#d98a52"],
  morango: ["#f9ecee", "#c14e6b"],
};

const CHAVES: Record<Tema, { nome: string; desc: string }> = {
  organic: { nome: "tema.organic", desc: "tema.organicDesc" },
  "meia-noite": { nome: "tema.meiaNoite", desc: "tema.meiaNoiteDesc" },
  morango: { nome: "tema.morango", desc: "tema.morangoDesc" },
};

export function SeletorTema() {
  const { t } = useTranslation();
  const tema = useTema();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="card-kicker">{t("tema.aparencia")}</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {TEMAS.map((opcao) => {
          const ativo = opcao.id === tema;
          const [fundo, destaque] = AMOSTRA[opcao.id];
          return (
            <button
              key={opcao.id}
              type="button"
              onClick={() => definirTema(opcao.id)}
              title={t(CHAVES[opcao.id].desc)}
              aria-pressed={ativo}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "10px 8px",
                borderRadius: 16,
                cursor: "pointer",
                background: "var(--color-neutral-100)",
                border: ativo ? "2px solid var(--color-accent)" : "2px solid var(--color-divider)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: `linear-gradient(135deg, ${fundo} 50%, ${destaque} 50%)`,
                  border: "1px solid var(--color-divider)",
                }}
              />
              <span style={{ fontSize: 12, fontWeight: ativo ? 700 : 500 }}>
                {t(CHAVES[opcao.id].nome)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
