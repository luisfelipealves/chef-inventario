import { forwardRef, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Package, BookOpen, Users, ClipboardList, Search } from "lucide-react";
import type { Cliente, Ingrediente, Pedido, Receita } from "@/lib/db";
import { formatEuro } from "@/lib/format";
import { totaisPedido } from "@/lib/pedido-calc";
import { custoTotalReceita } from "@/lib/receita-custo";
import { useShell, type ModuloLista } from "@/lib/shell";

interface Datasets {
  ingredientes: Ingrediente[];
  receitas: Receita[];
  clientes: Cliente[];
  pedidos: Pedido[];
  clienteMap: Map<number, Cliente>;
  receitaMap: Map<number, Receita>;
  ingMap: Map<number, Ingrediente>;
}

interface Resultado {
  module: ModuloLista;
  id: number;
  tipo: string;
  nome: string;
  meta: string;
  icon: typeof Package;
}

const LIMITE = 8;

function construirResultados(q: string, d: Datasets): Resultado[] {
  const termo = q.trim().toLowerCase();
  if (!termo) return [];
  const inclui = (v: string | undefined) => (v ?? "").toLowerCase().includes(termo);
  const out: Resultado[] = [];

  // Ordem: Ingredientes → Receitas → Clientes → Pedidos.
  for (const ing of d.ingredientes) {
    if (out.length >= LIMITE) break;
    if (!inclui(ing.nome)) continue;
    out.push({
      module: "ingredientes",
      id: ing.id,
      tipo: "Ingrediente",
      nome: ing.nome,
      meta: `${ing.quantidadeEmbalagem} ${ing.unidade} · ${formatEuro(ing.precoEmbalagem, { compact: true })}`,
      icon: Package,
    });
  }
  for (const r of d.receitas) {
    if (out.length >= LIMITE) break;
    if (!inclui(r.nome)) continue;
    const custo = custoTotalReceita(r, d.ingMap);
    out.push({
      module: "receitas",
      id: r.id,
      tipo: "Receita",
      nome: r.nome,
      meta: `custo ${formatEuro(custo, { compact: true })} · rende ${r.rendimento} ${r.unidadeRendimento}`,
      icon: BookOpen,
    });
  }
  for (const c of d.clientes) {
    if (out.length >= LIMITE) break;
    if (!inclui(c.nome) && !inclui(c.telefone) && !inclui(c.nif) && !inclui(c.endereco)) continue;
    out.push({
      module: "clientes",
      id: c.id,
      tipo: "Cliente",
      nome: c.nome,
      meta: c.telefone || "—",
      icon: Users,
    });
  }
  for (const p of d.pedidos) {
    if (out.length >= LIMITE) break;
    const cliente = d.clienteMap.get(p.clienteId);
    if (!inclui(cliente?.nome)) continue;
    const totais = totaisPedido(p.itens, d.receitaMap, d.ingMap);
    out.push({
      module: "pedidos",
      id: p.id,
      tipo: "Pedido",
      nome: cliente?.nome ?? "Cliente removido",
      meta: `entrega ${p.dataEntrega} · ${formatEuro(totais.venda, { compact: true })}`,
      icon: ClipboardList,
    });
  }
  return out;
}

const ROTA: Record<ModuloLista, string> = {
  ingredientes: "/ingredientes",
  receitas: "/receitas",
  clientes: "/clientes",
  pedidos: "/pedidos",
};

export const GlobalSearch = forwardRef<HTMLInputElement, { datasets: Datasets }>(
  function GlobalSearch({ datasets }, ref) {
    const { query, setQuery, setSelection } = useShell();
    const navigate = useNavigate();

    const resultados = useMemo(() => construirResultados(query, datasets), [query, datasets]);

    function abrir(r: Resultado) {
      setSelection(r.module, r.id);
      setQuery("");
      navigate({ to: ROTA[r.module] });
    }

    return (
      <div className="topbar-search">
        <Search className="topbar-search-icon" size={16} strokeWidth={2.75} />
        <input
          ref={ref}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar em tudo…"
          aria-label="Pesquisa global"
        />
        {query.trim() && (
          <div className="search-dropdown" role="listbox">
            {resultados.length === 0 ? (
              <p className="search-empty">Nada encontrado.</p>
            ) : (
              resultados.map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={`${r.module}-${r.id}`}
                    type="button"
                    className="search-result"
                    onClick={() => abrir(r)}
                  >
                    <Icon className="search-result-icon" size={16} strokeWidth={2.75} />
                    <span className="search-result-name">{r.nome}</span>
                    <span className="search-result-meta">{r.meta}</span>
                    <span className="tag tag-neutral">{r.tipo}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  },
);
