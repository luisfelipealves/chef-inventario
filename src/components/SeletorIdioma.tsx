import { useTranslation } from "react-i18next";
import { IDIOMAS, definirIdioma, idiomaAtual } from "@/lib/i18n";

export function SeletorIdioma() {
  const { t } = useTranslation();
  const atual = idiomaAtual();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="card-kicker">{t("idioma.titulo")}</span>
      <p style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{t("idioma.descricao")}</p>
      <div className="seg" role="tablist">
        {IDIOMAS.map((i) => (
          <button
            key={i.id}
            type="button"
            role="tab"
            className="seg-opt"
            data-active={atual === i.id}
            aria-selected={atual === i.id}
            onClick={() => definirIdioma(i.id)}
          >
            {i.nome}
          </button>
        ))}
      </div>
    </div>
  );
}
