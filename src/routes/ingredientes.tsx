import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Package, Plus, ShoppingBasket, TriangleAlert } from "lucide-react";
import { db, type Ingrediente, type Receita } from "@/lib/db";
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
import { IngredienteFormDialog } from "@/components/ingredientes/IngredienteFormDialog";
import { custoPorUnidade, formatEuro, unidadeMinimaLabel } from "@/lib/format";
import { calcularAlertasStock, mapaAlertas, type AlertaStock } from "@/lib/stock-alerta";
import { useHydrated } from "@/hooks/use-hydrated";
import { useShell } from "@/lib/shell";
import { FiltroBar, type FiltroOpcao } from "@/components/lista/FiltroBar";

export const Route = createFileRoute("/ingredientes")({
  head: () => ({
    meta: [
      { title: "Ingredientes — ChefGestão" },
      {
        name: "description",
        content: "Gere o teu stock de ingredientes e vê o custo por unidade mínima em tempo real.",
      },
    ],
  }),
  component: IngredientesPage,
});

const FILTROS: FiltroOpcao[] = [
  { key: "todos", label: "Todos" },
  { key: "stock-baixo", label: "Stock baixo" },
  { key: "sem-codigo", label: "Sem código" },
];

function IngredientesPage() {
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const ingredientes = useLiveQuery(
    () => (hydrated ? db.ingredientes.orderBy("nome").toArray() : []),
    [hydrated],
  );
  const receitas = useLiveQuery(
    () => (hydrated ? db.receitas.orderBy("nome").toArray() : []),
    [hydrated],
    [],
  );
  const pedidos = useLiveQuery(
    () => (hydrated ? db.pedidos.orderBy("dataEntrega").toArray() : []),
    [hydrated],
    [],
  );

  const lista = useMemo(() => ingredientes ?? [], [ingredientes]);
  const alertaMap = useMemo(
    () => mapaAlertas(calcularAlertasStock(lista, receitas, pedidos)),
    [lista, receitas, pedidos],
  );

  const { filtro, setFiltro, selection, setSelection, sheet, closeSheet, openSheet } = useShell();
  const filtroAtual = filtro.ingredientes;

  const filtrados = useMemo(() => {
    if (filtroAtual === "stock-baixo") return lista.filter((i) => alertaMap.has(i.id));
    if (filtroAtual === "sem-codigo") return lista.filter((i) => !i.codigoBarras);
    return lista;
  }, [lista, filtroAtual, alertaMap]);

  const selecionado =
    filtrados.find((i) => i.id === selection.ingredientes) ?? filtrados[0] ?? null;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ingrediente | null>(null);
  const [initialTab, setInitialTab] = useState<"dados" | "compra">("dados");
  const [toDelete, setToDelete] = useState<Ingrediente | null>(null);

  useEffect(() => {
    if (sheet?.module !== "ingredientes") return;
    if (sheet.mode === "novo") {
      setEditing(null);
      setInitialTab("dados");
      setFormOpen(true);
    } else if (sheet.id != null) {
      setEditing(lista.find((i) => i.id === sheet.id) ?? null);
      setInitialTab(sheet.mode === "compra" ? "compra" : "dados");
      setFormOpen(true);
    }
    closeSheet();
  }, [sheet, closeSheet, lista]);

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await db.ingredientes.delete(toDelete.id);
      toast.success("Ingrediente removido");
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
          onChange={(k) => setFiltro("ingredientes", k)}
          contagem={`${filtrados.length} de ${lista.length} ingredientes`}
        />

        {ingredientes === undefined ? (
          <SkeletonTabela />
        ) : lista.length === 0 ? (
          <EmptyState onAdd={() => openSheet({ module: "ingredientes", mode: "novo" })} />
        ) : (
          <div className="lista-table-wrap">
            <table className="lista-table">
              <thead>
                <tr>
                  <th>Ingrediente</th>
                  <th className="num">Stock</th>
                  <th className="num">Preço embalagem</th>
                  <th className="num">Custo unitário</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((ing) => {
                  const unit = custoPorUnidade(ing.precoEmbalagem, ing.quantidadeEmbalagem);
                  return (
                    <tr
                      key={ing.id}
                      data-selected={selecionado?.id === ing.id}
                      onClick={() => setSelection("ingredientes", ing.id)}
                    >
                      <td className="primeira">{ing.nome}</td>
                      <td className="num">
                        {ing.quantidadeEmbalagem} {ing.unidade}
                      </td>
                      <td className="num">{formatEuro(ing.precoEmbalagem, { compact: true })}</td>
                      <td className="num" style={{ color: "var(--color-accent-700)" }}>
                        {formatEuro(unit)} / {unidadeMinimaLabel(ing.unidade)}
                      </td>
                      <td>
                        {alertaMap.has(ing.id) && (
                          <span className="tag tag-accent">Stock baixo</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <aside className="detalhe-panel">
        {selecionado ? (
          <IngredienteDetalhe
            ingrediente={selecionado}
            alerta={alertaMap.get(selecionado.id) ?? null}
            receitas={receitas}
            onCompra={() =>
              openSheet({ module: "ingredientes", mode: "compra", id: selecionado.id })
            }
            onEdit={() => openSheet({ module: "ingredientes", mode: "editar", id: selecionado.id })}
            onAbrirReceita={(id) => {
              setSelection("receitas", id);
              navigate({ to: "/receitas" });
            }}
          />
        ) : (
          <div className="detalhe-empty">Selecciona um ingrediente.</div>
        )}
      </aside>

      <IngredienteFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        ingrediente={editing}
        initialTab={initialTab}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover ingrediente?</AlertDialogTitle>
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

function IngredienteDetalhe({
  ingrediente,
  alerta,
  receitas,
  onCompra,
  onEdit,
  onAbrirReceita,
}: {
  ingrediente: Ingrediente;
  alerta: AlertaStock | null;
  receitas: Receita[];
  onCompra: () => void;
  onEdit: () => void;
  onAbrirReceita: (id: number) => void;
}) {
  const unit = custoPorUnidade(ingrediente.precoEmbalagem, ingrediente.quantidadeEmbalagem);

  const usadoEm = useMemo(
    () =>
      receitas
        .map((r) => {
          const qtd = r.ingredientes
            .filter((l) => l.ingredienteId === ingrediente.id)
            .reduce((acc, l) => acc + l.quantidade, 0);
          return qtd > 0 ? { receita: r, qtd } : null;
        })
        .filter((x): x is { receita: Receita; qtd: number } => x != null),
    [receitas, ingrediente.id],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <span className="card-kicker">Ingrediente</span>
        <h3 style={{ fontSize: 25, margin: "2px 0" }}>{ingrediente.nome}</h3>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="detalhe-card" style={{ padding: "14px 16px" }}>
          <span
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--color-neutral-600)",
            }}
          >
            Stock
          </span>
          <span
            style={{
              display: "block",
              fontFamily: "var(--font-heading)",
              fontSize: 22,
              marginTop: 4,
            }}
          >
            {ingrediente.quantidadeEmbalagem} {ingrediente.unidade}
          </span>
        </div>
        <div className="detalhe-card" style={{ padding: "14px 16px" }}>
          <span
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--color-neutral-600)",
            }}
          >
            Por {unidadeMinimaLabel(ingrediente.unidade)}
          </span>
          <span
            style={{
              display: "block",
              fontFamily: "var(--font-heading)",
              fontSize: 22,
              marginTop: 4,
              color: "var(--color-accent-700)",
            }}
          >
            {formatEuro(unit)}
          </span>
        </div>
      </div>

      <div className="detalhe-card">
        <div className="kv">
          <span className="kv-label">Preço da embalagem</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatEuro(ingrediente.precoEmbalagem, { compact: true })}
          </span>
        </div>
        <div className="kv">
          <span className="kv-label">Código de barras</span>
          <span>{ingrediente.codigoBarras || "—"}</span>
        </div>
      </div>

      {alerta && (
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            background: "var(--color-accent-100)",
            color: "var(--color-accent-800)",
            borderRadius: 20,
            padding: "13px 16px",
          }}
        >
          <TriangleAlert size={16} strokeWidth={2.75} style={{ flex: "none", marginTop: 1 }} />
          <span style={{ fontSize: 12 }}>
            Faltam {Math.round(alerta.falta)} {ingrediente.unidade} para cobrir os pedidos
            confirmados desta semana.
          </span>
        </div>
      )}

      {usadoEm.length > 0 && (
        <div>
          <span className="card-kicker">Usado em</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            {usadoEm.map(({ receita, qtd }) => (
              <button
                key={receita.id}
                type="button"
                onClick={() => onAbrirReceita(receita.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "11px 15px",
                  borderRadius: 999,
                  background: "var(--color-bg)",
                  border: 0,
                  cursor: "pointer",
                  color: "var(--color-text)",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>{receita.nome}</span>
                <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
                  {qtd} {ingrediente.unidade}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="detalhe-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={onCompra}>
          <ShoppingBasket size={16} strokeWidth={2.75} />
          Adicionar compra
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          onClick={onEdit}
          aria-label="Editar ingrediente"
        >
          <Pencil size={16} strokeWidth={2.75} />
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
        <Package size={28} strokeWidth={2.75} />
      </div>
      <h2 style={{ fontSize: 20 }}>Ainda sem ingredientes</h2>
      <p style={{ fontSize: 14, color: "var(--color-neutral-600)", maxWidth: 320 }}>
        Adiciona a tua primeira compra para veres o custo por grama, ml ou unidade automaticamente.
      </p>
      <button type="button" className="btn btn-primary" onClick={onAdd}>
        <Plus size={16} strokeWidth={2.75} />
        Novo ingrediente
      </button>
    </div>
  );
}
