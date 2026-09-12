import type { ReactNode } from "react";

export interface FiltroOpcao {
  key: string;
  label: string;
}

export function FiltroBar({
  opcoes,
  valor,
  onChange,
  contagem,
  acao,
}: {
  opcoes: FiltroOpcao[];
  valor: string;
  onChange: (key: string) => void;
  contagem: string;
  acao?: ReactNode;
}) {
  return (
    <div className="lista-filtros">
      <div className="seg" role="tablist">
        {opcoes.map((o) => (
          <button
            key={o.key}
            type="button"
            role="tab"
            className="seg-opt"
            data-active={valor === o.key}
            aria-selected={valor === o.key}
            onClick={() => onChange(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="lista-filtros-meta">
        {acao && <div className="lista-filtros-action">{acao}</div>}
        <span className="lista-count">{contagem}</span>
      </div>
    </div>
  );
}
