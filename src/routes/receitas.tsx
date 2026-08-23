import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Printer, BookOpen, Plus, CookingPot } from "lucide-react";
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
import { custoTotalReceita, custoPorDose, custoLinha } from "@/lib/receita-custo";
import { useHydrated } from "@/hooks/use-hydrated";
import { useShell } from "@/lib/shell";
import { FiltroBar, type FiltroOpcao } from "@/components/lista/FiltroBar";

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

const FILTROS: FiltroOpcao[] = [
  { key: "todas", label: "Todas" },
  { key: "rentaveis", label: "Mais rentáveis" },
  { key: "falhas", label: "Com falhas" },
];

interface ReceitaCalc {
  receita: Receita;
  custoTotal: number;
  custoDose: number;
  margem: number | null;
  temFalha: boolean;
}

function ReceitasPage() {
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
  const filtroAtual = filtro.receitas;

  const lista = useMemo(() => receitas ?? [], [receitas]);

  const calculados = useMemo<ReceitaCalc[]>(
    () =>
      lista.map((r) => {
        const custoTotal = custoTotalReceita(r, ingMap);
        const custoDose = custoPorDose(custoTotal, r.rendimento);
        const venda = r.precoVenda ?? 0;
        const margem = venda > 0 && custoDose > 0 ? ((venda - custoDose) / custoDose) * 100 : null;
        const temFalha = r.ingredientes.some((l) => !ingMap.has(l.ingredienteId));
        return { receita: r, custoTotal, custoDose, margem, temFalha };
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

  const selecionado =
    filtrados.find((c) => c.receita.id === selection.receitas) ?? filtrados[0] ?? null;

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
      await db.receitas.delete(toDelete.id);
      toast.success("Receita removida");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao remover");
    } finally {
      setToDelete(null);
    }
  }

  return (
    <div className="lista-view">
      <div className="lista-panel">
        <FiltroBar
          opcoes={FILTROS}
          valor={filtroAtual}
          onChange={(k) => setFiltro("receitas", k)}
          contagem={`${filtrados.length} de ${lista.length} fichas técnicas`}
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
                  <th>Receita</th>
                  <th className="num">Ingredientes</th>
                  <th>Rende</th>
                  <th className="num">Custo total</th>
                  <th className="num">Por dose</th>
                  <th className="num">Venda</th>
                  <th className="num">Margem</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr
                    key={c.receita.id}
                    data-selected={selecionado?.receita.id === c.receita.id}
                    onClick={() => setSelection("receitas", c.receita.id)}
                  >
                    <td className="primeira">{c.receita.nome}</td>
                    <td className="num">{c.receita.ingredientes.length}</td>
                    <td>
                      {c.receita.rendimento} {c.receita.unidadeRendimento}
                    </td>
                    <td className="num">{formatEuro(c.custoTotal, { compact: true })}</td>
                    <td className="num">{formatEuro(c.custoDose)}</td>
                    <td className="num">
                      {c.receita.precoVenda != null
                        ? formatEuro(c.receita.precoVenda, { compact: true })
                        : "—"}
                    </td>
                    <td
                      className="num"
                      style={{ color: "var(--color-accent-2-700)", fontWeight: 600 }}
                    >
                      {c.margem != null ? `+${Math.round(c.margem)}%` : "—"}
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
          <ReceitaDetalhe
            calc={selecionado}
            ingMap={ingMap}
            onEdit={() =>
              openSheet({ module: "receitas", mode: "editar", id: selecionado.receita.id })
            }
            onProduzir={() => setProducaoOpen(true)}
          />
        ) : (
          <div className="detalhe-empty">Selecciona uma receita.</div>
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
            <AlertDialogTitle>Remover receita?</AlertDialogTitle>
            <AlertDialogDescription>
              Vais eliminar <strong>{toDelete?.nome}</strong>. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="h-11 rounded-full">
              Remover
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
  const { receita, custoTotal, custoDose, margem } = calc;
  const prontas = receita.dosesProntas ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <span className="card-kicker">Ficha técnica</span>
        <h3 style={{ fontSize: 25, margin: "2px 0 4px" }}>{receita.nome}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
            Rende {receita.rendimento} {receita.unidadeRendimento}
          </span>
          <span className={prontas > 0 ? "tag tag-accent-2" : "tag tag-outline"}>
            {prontas} {receita.unidadeRendimento} prontas
          </span>
        </div>
      </div>

      <div className="detalhe-card" style={{ padding: "14px 18px" }}>
        {receita.ingredientes.map((l, i) => {
          const ing = ingMap.get(l.ingredienteId);
          return (
            <div
              key={i}
              className="kv"
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
                {ing?.nome ?? "Ingrediente em falta"}
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
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 15 }}>Custo total</span>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="detalhe-card">
          <span
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--color-neutral-600)",
            }}
          >
            Custo por dose
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
            Preço de venda
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

      {margem != null && (
        <div
          style={{
            background: "var(--color-accent-2-100)",
            color: "var(--color-accent-2-800)",
            borderRadius: 22,
            padding: "16px 18px",
          }}
        >
          <span
            style={{
              display: "block",
              fontFamily: "var(--font-heading)",
              fontSize: 19,
            }}
          >
            +{Math.round(margem)}%
          </span>
          <div
            style={{
              height: 7,
              borderRadius: 999,
              background: "color-mix(in srgb, var(--color-accent-2-800) 18%, transparent)",
              margin: "8px 0 6px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, margem / 4)}%`,
                background: "var(--color-accent-2-600)",
                borderRadius: 999,
              }}
            />
          </div>
          <span style={{ fontSize: 12, opacity: 0.85 }}>acima do custo</span>
        </div>
      )}

      <div className="detalhe-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={onProduzir}>
          <CookingPot size={16} strokeWidth={2.75} />
          Registar produção
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          onClick={onEdit}
          aria-label="Editar ficha"
        >
          <Pencil size={16} strokeWidth={2.75} />
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          onClick={() => window.print()}
          aria-label="Imprimir ficha"
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
  return (
    <div className="lista-empty">
      <div className="lista-empty-icon">
        <BookOpen size={28} strokeWidth={2.75} />
      </div>
      <h2 style={{ fontSize: 20 }}>Ainda sem receitas</h2>
      <p style={{ fontSize: 14, color: "var(--color-neutral-600)", maxWidth: 320 }}>
        Cria a tua primeira ficha técnica para veres o custo total e por dose.
      </p>
      <button type="button" className="btn btn-primary" onClick={onAdd}>
        <Plus size={16} strokeWidth={2.75} />
        Nova receita
      </button>
    </div>
  );
}
