import { AvisoCusto, ResumoIndicadores } from "@/components/custos/ResumoIndicadores";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Printer, BookOpen, Plus, CookingPot, Trash2 } from "lucide-react";
import { db, type Receita, type Ingrediente } from "@/lib/db";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ReceitaFormDialog } from "@/components/receitas/ReceitaFormDialog";
import { ProducaoDialog } from "@/components/receitas/ProducaoDialog";
import { formatEuro } from "@/lib/format";
import { resumoReceita, custoLinha } from "@/lib/receita-custo";
import { useHydrated } from "@/hooks/use-hydrated";
import { useIsMobile } from "@/hooks/use-mobile";
import { useShell } from "@/lib/shell";
import { MobileDetail } from "@/components/lista/MobileDetail";
import { FiltroBar, type FiltroOpcao } from "@/components/lista/FiltroBar";
import { eliminarReceita } from "@/lib/operacional";

export const Route = createFileRoute("/receitas")({
  head: () => ({
    meta: [
      { title: "Receitas — Caderninho de Receitas" },
      {
        name: "description",
        content: "Cria fichas técnicas e calcula o custo total e por dose de cada receita.",
      },
    ],
  }),
  component: ReceitasPage,
});

const FILTROS_KEYS = [
  { key: "todas", labelKey: "receitas.filtroTodas" },
  { key: "rentaveis", labelKey: "receitas.filtroRentaveis" },
  { key: "falhas", labelKey: "receitas.filtroFalhas" },
];

interface ReceitaCalc extends ReturnType<typeof resumoReceita> {
  receita: Receita;
  temFalha: boolean;
}

function ReceitasPage() {
  const { t } = useTranslation();
  const hydrated = useHydrated();
  const receitas = useLiveQuery(
    () => (hydrated ? db.receitas.orderBy("nome").toArray() : []),
    [hydrated],
  );
  const ingredientes = useLiveQuery(
    () => (hydrated ? db.ingredientes.orderBy("nome").toArray() : []),
    [hydrated],
    [],
  );

  const ingMap = useMemo(() => new Map(ingredientes.map((i) => [i.id, i])), [ingredientes]);

  const { filtro, setFiltro, selection, setSelection, sheet, closeSheet, openSheet } = useShell();
  const isMobile = useIsMobile();
  const filtroAtual = filtro.receitas;

  const lista = useMemo(() => receitas ?? [], [receitas]);

  const calculados = useMemo<ReceitaCalc[]>(
    () =>
      lista.map((r) => {
        const resumo = resumoReceita(r, ingMap);
        return { receita: r, ...resumo, temFalha: !resumo.completo };
      }),
    [lista, ingMap],
  );

  const filtrados = useMemo(() => {
    if (filtroAtual === "falhas") return calculados.filter((c) => c.temFalha);
    if (filtroAtual === "rentaveis") {
      return [...calculados].sort((a, b) => (b.margem ?? -Infinity) - (a.margem ?? -Infinity));
    }
    return calculados;
  }, [calculados, filtroAtual]);

  const selecionado = isMobile
    ? (filtrados.find((c) => c.receita.id === selection.receitas) ?? null)
    : (filtrados.find((c) => c.receita.id === selection.receitas) ?? filtrados[0] ?? null);

  const [formOpen, setFormOpen] = useState(false);
  const [producaoOpen, setProducaoOpen] = useState(false);
  const [editing, setEditing] = useState<Receita | null>(null);
  const [toDelete, setToDelete] = useState<Receita | null>(null);

  useEffect(() => {
    if (sheet?.module !== "receitas") return;
    if (sheet.mode === "novo") {
      setEditing(null);
      setFormOpen(true);
    } else if (sheet.mode === "editar" && sheet.id != null) {
      setEditing(lista.find((r) => r.id === sheet.id) ?? null);
      setFormOpen(true);
    }
    closeSheet();
  }, [sheet, closeSheet, lista]);

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await eliminarReceita(toDelete.id);
      toast.success(t("receitas.removida"));
    } catch (err) {
      console.error(err);
      toast.error(t("receitas.erroRemover"));
    } finally {
      setToDelete(null);
    }
  }

  return (
    <div className="lista-view" data-mobile-detail={isMobile && selecionado ? "true" : "false"}>
      <div className="lista-panel">
        <FiltroBar
          opcoes={FILTROS_KEYS.map((f): FiltroOpcao => ({ key: f.key, label: t(f.labelKey) }))}
          valor={filtroAtual}
          onChange={(k) => setFiltro("receitas", k)}
          contagem={t("receitas.contagem", { n: filtrados.length, total: lista.length })}
        />

        {receitas === undefined ? (
          <SkeletonTabela />
        ) : lista.length === 0 ? (
          <EmptyState onAdd={() => openSheet({ module: "receitas", mode: "novo" })} />
        ) : (
          <div className="lista-table-wrap">
            <table className="lista-table">
              <thead>
                <tr>
                  <th>{t("receitas.thReceita")}</th>
                  <th className="num">{t("receitas.thIngredientes")}</th>
                  <th>{t("receitas.thRende")}</th>
                  <th className="num">{t("receitas.thCustoTotal")}</th>
                  <th className="num">{t("receitas.thPorDose")}</th>
                  <th className="num">{t("receitas.thVenda")}</th>
                  <th className="num">{t("receitas.thMargem")}</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr
                    key={c.receita.id}
                    data-selected={selecionado?.receita.id === c.receita.id}
                    onClick={() => setSelection("receitas", c.receita.id)}
                  >
                    <td className="primeira" data-label={t("receitas.thReceita")}>
                      {c.receita.nome}
                      {c.temFalha && (
                        <span className="block text-sm" role="status">
                          {t("custos.incompletoCurto")}
                        </span>
                      )}
                    </td>
                    <td className="num" data-label={t("receitas.thIngredientes")}>
                      {c.receita.ingredientes.length}
                    </td>
                    <td data-label={t("receitas.thRende")}>
                      {c.receita.rendimento} {c.receita.unidadeRendimento}
                    </td>
                    <td className="num" data-label={t("receitas.thCustoTotal")}>
                      {formatEuro(c.custoTotal, { compact: true })}
                    </td>
                    <td className="num" data-label={t("receitas.thPorDose")}>
                      {formatEuro(c.custoDose)}
                    </td>
                    <td className="num" data-label={t("receitas.thVenda")}>
                      {c.receita.precoVenda != null
                        ? formatEuro(c.receita.precoVenda, { compact: true })
                        : "—"}
                    </td>
                    <td
                      className="num"
                      data-label={t("receitas.thMargem")}
                      style={{
                        color:
                          c.margem != null && c.margem < 0
                            ? "var(--color-accent-700)"
                            : "var(--color-accent-2-700)",
                        fontWeight: 600,
                      }}
                    >
                      {c.margem != null ? `${Math.round(c.margem)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <aside className="detalhe-panel">
        {selecionado ? (
          isMobile ? (
            <MobileDetail
              title={selecionado.receita.nome}
              backLabel={t("comum.voltar")}
              onBack={() => setSelection("receitas", null)}
              destructiveActions={
                <button
                  type="button"
                  className="btn btn-secondary btn-block mobile-detail-remove"
                  onClick={() => setToDelete(selecionado.receita)}
                >
                  <Trash2 size={16} strokeWidth={2.75} />
                  {t("comum.remover")}
                </button>
              }
            >
              <ReceitaDetalhe
                calc={selecionado}
                ingMap={ingMap}
                onEdit={() =>
                  openSheet({ module: "receitas", mode: "editar", id: selecionado.receita.id })
                }
                onProduzir={() => setProducaoOpen(true)}
              />
            </MobileDetail>
          ) : (
            <ReceitaDetalhe
              calc={selecionado}
              ingMap={ingMap}
              onEdit={() =>
                openSheet({ module: "receitas", mode: "editar", id: selecionado.receita.id })
              }
              onProduzir={() => setProducaoOpen(true)}
            />
          )
        ) : (
          <div className="detalhe-empty">{t("receitas.seleciona")}</div>
        )}
      </aside>

      {selecionado && (
        <ProducaoDialog
          open={producaoOpen}
          onOpenChange={setProducaoOpen}
          receita={selecionado.receita}
          ingMap={ingMap}
        />
      )}

      <ReceitaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        receita={editing}
        ingredientes={ingredientes}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("receitas.removerTitulo")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("receitas.removerDesc", { nome: toDelete?.nome ?? "" })}{" "}
              {t("comum.acaoIrreversivel")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-full">
              {t("comum.cancelar")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="h-11 rounded-full">
              {t("comum.remover")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReceitaDetalhe({
  calc,
  ingMap,
  onEdit,
  onProduzir,
}: {
  calc: ReceitaCalc;
  ingMap: Map<number, Ingrediente>;
  onEdit: () => void;
  onProduzir: () => void;
}) {
  const { t } = useTranslation();
  const { receita, custoTotal, custoDose } = calc;
  const prontas = receita.dosesProntas ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <span className="card-kicker">{t("receitas.kickerFicha")}</span>
        <h3 style={{ fontSize: 25, margin: "2px 0 4px" }}>{receita.nome}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
            {t("receitas.rende", { n: receita.rendimento, unidade: receita.unidadeRendimento })}
          </span>
          <span className={prontas > 0 ? "tag tag-accent-2" : "tag tag-outline"}>
            {t("receitas.prontas", { n: prontas, unidade: receita.unidadeRendimento })}
          </span>
        </div>
      </div>

      <div className="detalhe-card" style={{ padding: "14px 18px" }}>
        {receita.ingredientes.map((l, i) => {
          const ing = ingMap.get(l.ingredienteId);
          return (
            <div
              key={i}
              className="kv receita-detail-ingredient"
              style={{
                borderTop:
                  i === 0
                    ? "none"
                    : "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
                alignItems: "baseline",
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: ing ? undefined : "var(--color-accent-700)",
                }}
              >
                {ing?.nome ?? t("receitas.ingredienteFalta")}
              </span>
              <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
                {l.quantidade} {ing?.unidade ?? ""}
              </span>
              <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {formatEuro(custoLinha(l, ing), { compact: true })}
              </span>
            </div>
          );
        })}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid var(--color-divider)",
          }}
        >
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 15 }}>
            {t("receitas.custoTotal")}
          </span>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 19,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatEuro(custoTotal, { compact: true })}
          </span>
        </div>
      </div>

      <div
        className="receita-detail-metrics"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
      >
        <div className="detalhe-card">
          <span
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--color-neutral-600)",
            }}
          >
            {t("custos.custoUnidade", { unidade: receita.unidadeRendimento })}
          </span>
          <span
            style={{
              display: "block",
              fontFamily: "var(--font-heading)",
              fontSize: 20,
              marginTop: 4,
            }}
          >
            {formatEuro(custoDose)}
          </span>
        </div>
        <div className="detalhe-card">
          <span
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--color-neutral-600)",
            }}
          >
            {t("receitas.precoVenda")}
          </span>
          <span
            style={{
              display: "block",
              fontFamily: "var(--font-heading)",
              fontSize: 20,
              marginTop: 4,
            }}
          >
            {receita.precoVenda != null ? formatEuro(receita.precoVenda, { compact: true }) : "—"}
          </span>
        </div>
      </div>

      <div className="detalhe-card">
        <div>
          {t("custos.precoUnitario", { unidade: receita.unidadeRendimento })}:{" "}
          <strong>{formatEuro(calc.precoUnitario)}</strong>
        </div>
        <ResumoIndicadores
          resultado={calc.resultado}
          margem={calc.margem}
          acrescimo={calc.acrescimo}
        />
        <AvisoCusto completo={calc.completo} />
      </div>

      <div className="detalhe-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={onProduzir}>
          <CookingPot size={16} strokeWidth={2.75} />
          {t("receitas.registarProducao")}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          onClick={onEdit}
          aria-label={t("receitas.editarFicha")}
        >
          <Pencil size={16} strokeWidth={2.75} />
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          onClick={() => window.print()}
          aria-label={t("receitas.imprimirFicha")}
        >
          <Printer size={16} strokeWidth={2.75} />
        </button>
      </div>
    </div>
  );
}

function SkeletonTabela() {
  return (
    <div className="lista-table-wrap" aria-hidden>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingTop: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="lista-skeleton" style={{ width: `${90 - i * 6}%` }} />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="lista-empty">
      <div className="lista-empty-icon">
        <BookOpen size={28} strokeWidth={2.75} />
      </div>
      <h2 style={{ fontSize: 20 }}>{t("receitas.vazioTitulo")}</h2>
      <p style={{ fontSize: 14, color: "var(--color-neutral-600)", maxWidth: 320 }}>
        {t("receitas.vazioDesc")}
      </p>
      <button type="button" className="btn btn-primary" onClick={onAdd}>
        <Plus size={16} strokeWidth={2.75} />
        {t("topbar.novaReceita")}
      </button>
    </div>
  );
}
