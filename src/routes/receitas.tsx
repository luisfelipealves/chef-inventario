import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ArrowLeft, BookOpen } from "lucide-react";
import { db, type Receita } from "@/lib/db";
import { Button } from "@/components/ui/button";
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
import { formatEuro } from "@/lib/format";
import { custoTotalReceita, custoPorDose } from "@/lib/receita-custo";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/receitas")({
  head: () => ({
    meta: [
      { title: "Receitas — ChefGestão" },
      {
        name: "description",
        content:
          "Cria fichas técnicas e calcula o custo total e por dose de cada receita.",
      },
    ],
  }),
  component: ReceitasPage,
});

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

  const ingMap = useMemo(
    () => new Map((ingredientes ?? []).map((i) => [i.id, i])),
    [ingredientes],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Receita | null>(null);
  const [toDelete, setToDelete] = useState<Receita | null>(null);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(r: Receita) {
    setEditing(r);
    setFormOpen(true);
  }

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
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Button asChild variant="ghost" size="icon" className="h-10 w-10 shrink-0">
            <Link to="/" aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-foreground">Receitas</h1>
            <p className="text-xs text-muted-foreground">
              {receitas?.length ?? 0} fichas técnicas
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4">
        {receitas === undefined ? (
          <p className="py-10 text-center text-sm text-muted-foreground">A carregar…</p>
        ) : receitas.length === 0 ? (
          <EmptyState onAdd={openNew} />
        ) : (
          <ul className="space-y-3">
            {receitas.map((r) => {
              const total = custoTotalReceita(r, ingMap);
              const dose = custoPorDose(total, r.rendimento);
              const emFalta = r.ingredientes.filter(
                (l) => !ingMap.has(l.ingredienteId),
              ).length;
              const margem =
                r.precoVenda != null ? r.precoVenda - total : null;
              return (
                <ReceitaCard
                  key={r.id}
                  receita={r}
                  custoTotal={total}
                  custoDose={dose}
                  margem={margem}
                  emFalta={emFalta}
                  onEdit={() => openEdit(r)}
                  onDelete={() => setToDelete(r)}
                />
              );
            })}
          </ul>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <Button onClick={openNew} className="h-14 w-full text-base">
            <Plus className="mr-2 h-5 w-5" />
            Nova receita
          </Button>
        </div>
      </div>

      <ReceitaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        receita={editing}
        ingredientes={ingredientes ?? []}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover receita?</AlertDialogTitle>
            <AlertDialogDescription>
              Vais eliminar <strong>{toDelete?.nome}</strong>. Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="h-12">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReceitaCard({
  receita,
  custoTotal,
  custoDose,
  margem,
  emFalta,
  onEdit,
  onDelete,
}: {
  receita: Receita;
  custoTotal: number;
  custoDose: number;
  margem: number | null;
  emFalta: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const margemPct =
    margem != null && custoTotal > 0 ? (margem / custoTotal) * 100 : null;

  return (
    <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-card-foreground">
            {receita.nome}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {receita.ingredientes.length} ingredientes · rende {receita.rendimento}{" "}
            {receita.unidadeRendimento}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={onEdit}
            aria-label="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-destructive hover:text-destructive"
            onClick={onDelete}
            aria-label="Remover"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className={`mt-3 grid gap-2 rounded-lg bg-muted/40 p-3 text-sm ${margem != null ? "grid-cols-3" : "grid-cols-2"}`}>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Custo total
          </p>
          <p className="font-semibold tabular-nums text-foreground">
            {formatEuro(custoTotal, { compact: true })}
          </p>
        </div>
        <div className={margem != null ? "text-center" : "text-right"}>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Por {receita.unidadeRendimento === "un" ? "dose" : receita.unidadeRendimento}
          </p>
          <p className="font-semibold tabular-nums text-foreground">
            {formatEuro(custoDose)}
          </p>
        </div>
        {margem != null && (
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Margem
            </p>
            <p className={`font-semibold tabular-nums ${margem >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatEuro(margem, { compact: true })}
              {margemPct != null && (
                <span className="ml-1 text-xs font-normal">
                  ({margemPct >= 0 ? "+" : ""}{margemPct.toFixed(0)}%)
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {receita.precoVenda != null && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Preço de venda:{" "}
          <span className="font-medium text-foreground">
            {formatEuro(receita.precoVenda, { compact: true })}
          </span>
        </p>
      )}

      {emFalta > 0 && (
        <p className="mt-2 text-xs text-destructive">
          {emFalta} ingrediente{emFalta > 1 ? "s" : ""} em falta no stock — edita a
          receita.
        </p>
      )}
    </li>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-12 flex flex-col items-center text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-muted">
        <BookOpen className="h-7 w-7 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">
        Ainda sem receitas
      </h2>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Cria a tua primeira ficha técnica para veres o custo total e por dose.
      </p>
      <Button onClick={onAdd} className="mt-6 h-12">
        <Plus className="mr-2 h-4 w-4" />
        Nova receita
      </Button>
    </div>
  );
}
