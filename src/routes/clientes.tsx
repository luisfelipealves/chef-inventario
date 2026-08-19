import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ArrowLeft, Users, Phone, MapPin, Hash, Search } from "lucide-react";
import { db, type Cliente } from "@/lib/db";
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
import { ClienteFormDialog } from "@/components/clientes/ClienteFormDialog";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — ChefGestão" },
      {
        name: "description",
        content:
          "Cadastro simples de clientes com nome, telefone, endereço e NIF, guardado no teu dispositivo.",
      },
      { property: "og:title", content: "Clientes — ChefGestão" },
      {
        property: "og:description",
        content:
          "Cadastro simples de clientes com nome, telefone, endereço e NIF, guardado no teu dispositivo.",
      },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  const hydrated = useHydrated();
  const clientes = useLiveQuery(
    () => (hydrated ? db.clientes.orderBy("nome").toArray() : []),
    [hydrated],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [toDelete, setToDelete] = useState<Cliente | null>(null);
  const [search, setSearch] = useState("");

  const normalizedSearch = search.trim().toLowerCase();
  const filteredClientes = useMemo(() => {
    if (!clientes || !normalizedSearch) return clientes;
    return clientes.filter((c) =>
      [c.nome, c.telefone, c.endereco, c.nif]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(normalizedSearch)),
    );
  }, [clientes, normalizedSearch]);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(c: Cliente) {
    setEditing(c);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await db.clientes.delete(toDelete.id);
      toast.success("Cliente removido");
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
            <h1 className="truncate text-lg font-semibold text-foreground">Clientes</h1>
            <p className="text-xs text-muted-foreground">
              {clientes?.length ?? 0} registados
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4">
        {clientes === undefined ? (
          <p className="py-10 text-center text-sm text-muted-foreground">A carregar…</p>
        ) : clientes.length === 0 ? (
          <EmptyState onAdd={openNew} />
        ) : (
          <ul className="space-y-3">
            {clientes.map((c) => (
              <ClienteCard
                key={c.id}
                cliente={c}
                onEdit={() => openEdit(c)}
                onDelete={() => setToDelete(c)}
              />
            ))}
          </ul>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <Button onClick={openNew} className="h-14 w-full text-base">
            <Plus className="mr-2 h-5 w-5" />
            Adicionar cliente
          </Button>
        </div>
      </div>

      <ClienteFormDialog open={formOpen} onOpenChange={setFormOpen} cliente={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Vais eliminar <strong>{toDelete?.nome}</strong>. Esta ação não pode ser
              desfeita.
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

function ClienteCard({
  cliente,
  onEdit,
  onDelete,
}: {
  cliente: Cliente;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-base font-semibold text-card-foreground">
            {cliente.nome}
          </h2>
          {cliente.telefone && (
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <a href={`tel:${cliente.telefone}`} className="truncate hover:underline">
                {cliente.telefone}
              </a>
            </p>
          )}
          {cliente.endereco && (
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{cliente.endereco}</span>
            </p>
          )}
          {cliente.nif && (
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Hash className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">NIF {cliente.nif}</span>
            </p>
          )}
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
    </li>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-12 flex flex-col items-center text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-muted">
        <Users className="h-7 w-7 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">Ainda sem clientes</h2>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Regista o nome, telefone, endereço e NIF dos teus clientes para encomendas futuras.
      </p>
      <Button onClick={onAdd} className="mt-6 h-12">
        <Plus className="mr-2 h-4 w-4" />
        Adicionar primeiro
      </Button>
    </div>
  );
}
