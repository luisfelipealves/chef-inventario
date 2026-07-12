import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Plus, Pencil, Trash2, ArrowLeft, Package } from "lucide-react";
import { db, type Ingrediente } from "@/lib/db";
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
import { IngredienteFormDialog } from "@/components/ingredientes/IngredienteFormDialog";
import { custoPorUnidade, formatEuro, unidadeMinimaLabel } from "@/lib/format";
import { useHydrated } from "@/hooks/use-hydrated";

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

function IngredientesPage() {
  const hydrated = useHydrated();
  const ingredientes = useLiveQuery(
    () => (hydrated ? db.ingredientes.orderBy("nome").toArray() : []),
    [hydrated],
  );


  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ingrediente | null>(null);
  const [toDelete, setToDelete] = useState<Ingrediente | null>(null);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(ing: Ingrediente) {
    setEditing(ing);
    setFormOpen(true);
  }

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
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Button asChild variant="ghost" size="icon" className="h-10 w-10 shrink-0">
            <Link to="/" aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-foreground">
              Ingredientes
            </h1>
            <p className="text-xs text-muted-foreground">
              {ingredientes?.length ?? 0} no stock
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4">
        {ingredientes === undefined ? (
          <p className="py-10 text-center text-sm text-muted-foreground">A carregar…</p>
        ) : ingredientes.length === 0 ? (
          <EmptyState onAdd={openNew} />
        ) : (
          <ul className="space-y-3">
            {ingredientes.map((ing) => (
              <IngredienteCard
                key={ing.id}
                ingrediente={ing}
                onEdit={() => openEdit(ing)}
                onDelete={() => setToDelete(ing)}
              />
            ))}
          </ul>
        )}
      </main>

      {/* FAB */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <Button onClick={openNew} className="h-14 w-full text-base">
            <Plus className="mr-2 h-5 w-5" />
            Adicionar ingrediente
          </Button>
        </div>
      </div>

      <IngredienteFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        ingrediente={editing}
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

function IngredienteCard({
  ingrediente,
  onEdit,
  onDelete,
}: {
  ingrediente: Ingrediente;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const unitario = custoPorUnidade(
    ingrediente.precoEmbalagem,
    ingrediente.quantidadeEmbalagem,
  );

  return (
    <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-card-foreground">
            {ingrediente.nome}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ingrediente.quantidadeEmbalagem} {ingrediente.unidade} ·{" "}
            {formatEuro(ingrediente.precoEmbalagem, { compact: true })}
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

      <div className="mt-3 flex items-center justify-between rounded-lg bg-muted px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          Custo por {unidadeMinimaLabel(ingrediente.unidade)}
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatEuro(unitario)}
        </span>
      </div>
    </li>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-12 flex flex-col items-center text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-muted">
        <Package className="h-7 w-7 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">
        Ainda sem ingredientes
      </h2>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Adiciona a tua primeira compra para veres o custo por grama, ml ou unidade automaticamente.
      </p>
      <Button onClick={onAdd} className="mt-6 h-12">
        <Plus className="mr-2 h-4 w-4" />
        Adicionar primeiro
      </Button>
    </div>
  );
}
