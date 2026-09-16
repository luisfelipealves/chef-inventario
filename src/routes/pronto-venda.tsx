import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { ArrowRight, BookOpen, ShoppingBasket } from "lucide-react";
import { db, type Receita } from "@/lib/db";
import { useHydrated } from "@/hooks/use-hydrated";
import { useShell } from "@/lib/shell";
import { receitasProntas } from "@/lib/pronto-venda";

export const Route = createFileRoute("/pronto-venda")({
  head: () => ({
    meta: [
      { title: "Prontos para venda — Caderninho de Receitas" },
      {
        name: "description",
        content: "Consulta as receitas produzidas que ainda estão prontas para venda.",
      },
    ],
  }),
  component: ProntoVendaPage,
});

function ProntoVendaPage() {
  const { t } = useTranslation();
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const { setSelection } = useShell();
  const receitas = useLiveQuery(
    () => (hydrated ? db.receitas.orderBy("nome").toArray() : []),
    [hydrated],
  );
  const prontos = useMemo(() => receitasProntas(receitas ?? []), [receitas]);

  function abrirFicha(receita: Receita) {
    setSelection("receitas", receita.id);
    navigate({ to: "/receitas" });
  }

  return (
    <main className="pronto-venda-page">
      <div className="pronto-venda-heading">
        <div>
          <span className="card-kicker">{t("prontoVenda.kicker")}</span>
          <h2>{t("prontoVenda.titulo")}</h2>
          <p>{t("prontoVenda.descricao")}</p>
        </div>
        <div className="pronto-venda-summary">
          <ShoppingBasket size={22} strokeWidth={2.5} />
          <span>{t("prontoVenda.count", { count: prontos.length })}</span>
        </div>
      </div>

      {receitas === undefined ? (
        <div className="pronto-venda-grid" aria-busy="true" aria-label={t("comum.aCarregar")}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="pronto-venda-card pronto-venda-skeleton" key={i} />
          ))}
        </div>
      ) : prontos.length === 0 ? (
        <div className="pronto-venda-empty">
          <div className="lista-empty-icon">
            <ShoppingBasket size={28} strokeWidth={2.75} />
          </div>
          <h3>{t("prontoVenda.vazioTitulo")}</h3>
          <p>{t("prontoVenda.vazioDesc")}</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate({ to: "/receitas" })}
          >
            <BookOpen size={16} strokeWidth={2.75} />
            {t("prontoVenda.verReceitas")}
          </button>
        </div>
      ) : (
        <div className="pronto-venda-grid">
          {prontos.map((receita) => (
            <article className="pronto-venda-card" key={receita.id}>
              <div className="pronto-venda-card-head">
                <div className="pronto-venda-icon">
                  <ShoppingBasket size={20} strokeWidth={2.5} />
                </div>
                <div className="pronto-venda-card-title">
                  <span className="card-kicker">{t("prontoVenda.cardKicker")}</span>
                  <h3>{receita.nome}</h3>
                </div>
              </div>
              <div className="pronto-venda-stock">
                <strong>{receita.dosesProntas}</strong>
                <span>
                  {t("prontoVenda.disponiveis", {
                    unidade: receita.unidadeRendimento,
                  })}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost pronto-venda-link"
                onClick={() => abrirFicha(receita)}
              >
                {t("prontoVenda.verFicha")}
                <ArrowRight size={16} strokeWidth={2.75} />
              </button>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
