import { forwardRef, useMemo } from "react";
import { useTranslation, type UseTranslationResponse } from "react-i18next";
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

type T = UseTranslationResponse<"translation", undefined>["t"];

function construirResultados(q: string, d: Datasets, t: T): Resultado[] {
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
      tipo: t("pesquisa.tipoIngrediente"),
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
      tipo: t("pesquisa.tipoReceita"),
      nome: r.nome,
      meta: t("pesquisa.metaReceita", {
        custo: formatEuro(custo, { compact: true }),
        rendimento: r.rendimento,
        unidade: r.unidadeRendimento,
      }),
      icon: BookOpen,
    });
  }
  for (const c of d.clientes) {
    if (out.length >= LIMITE) break;
    if (!inclui(c.nome) && !inclui(c.telefone) && !inclui(c.nif) && !inclui(c.endereco)) continue;
    out.push({
      module: "clientes",
      id: c.id,
      tipo: t("pesquisa.tipoCliente"),
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
      tipo: t("pesquisa.tipoPedido"),
      nome: cliente?.nome ?? t("painel.clienteRemovido"),
      meta: t("pesquisa.metaPedido", {
        data: p.dataEntrega,
        valor: formatEuro(totais.venda, { compact: true }),
      }),
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
    const { t } = useTranslation();
    const { query, setQuery, setSelection, closeMobileNav } = useShell();
    const navigate = useNavigate();

    const resultados = useMemo(() => construirResultados(query, datasets, t), [query, datasets, t]);

    function abrir(r: Resultado) {
      setSelection(r.module, r.id);
      setQuery("");
      closeMobileNav();
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
          placeholder={t("topbar.pesquisar")}
          aria-label={t("topbar.pesquisaGlobal")}
        />
        {query.trim() && (
          <div className="search-dropdown" role="listbox">
            {resultados.length === 0 ? (
              <p className="search-empty">{t("pesquisa.nadaEncontrado")}</p>
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
