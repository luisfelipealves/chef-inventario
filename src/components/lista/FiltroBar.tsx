export interface FiltroOpcao {
  key: string;
  label: string;
}

export function FiltroBar({
  opcoes,
  valor,
  onChange,
  contagem,
}: {
  opcoes: FiltroOpcao[];
  valor: string;
  onChange: (key: string) => void;
  contagem: string;
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
      <span className="lista-count">{contagem}</span>
    </div>
  );
}
