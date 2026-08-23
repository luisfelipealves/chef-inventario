import { TEMAS, definirTema, useTema, type Tema } from "@/lib/tema";

/** Amostras de cor de cada tema (fundo + destaque), para o seletor. */
const AMOSTRA: Record<Tema, [string, string]> = {
  organic: ["#f5ead8", "#c67139"],
  "meia-noite": ["#1d1917", "#d98a52"],
  morango: ["#f9ecee", "#c14e6b"],
};

export function SeletorTema() {
  const tema = useTema();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="card-kicker">Aparência</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {TEMAS.map((t) => {
          const ativo = t.id === tema;
          const [fundo, destaque] = AMOSTRA[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => definirTema(t.id)}
              title={t.descricao}
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
              <span style={{ fontSize: 12, fontWeight: ativo ? 700 : 500 }}>{t.nome}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
