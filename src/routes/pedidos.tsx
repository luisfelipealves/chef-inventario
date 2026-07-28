import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ArrowLeft, ClipboardList } from "lucide-react";
import { db, type Pedido } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { PedidoFormDialog } from "@/components/pedidos/PedidoFormDialog";
import { formatEuro } from "@/lib/format";
import { estadoLabel, totaisPedido } from "@/lib/pedido-calc";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos — ChefGestão" },
      {
        name: "description",
        content:
          "Junta clientes e receitas num pedido e calcula custo, lucro e valor final.",
      },
      { property: "og:title", content: "Pedidos — ChefGestão" },
      {
        property: "og:description",
        content: "Gere encomendas e calcula o valor final de cada pedido.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PedidosPage,
});

function PedidosPage() {
  const hydrated = useHydrated();
  const pedidos = useLiveQuery(
    () => (hydrated ? db.pedidos.orderBy("dataEntrega").toArray() : []),
    [hydrated],
  );
  const clientes = useLiveQuery(
    () => (hydrated ? db.clientes.orderBy("nome").toArray() : []),
    [hydrated],
    [],
  );
  const receitas = useLiveQuery(
    () => (hydrated ? db.receitas.orderBy("nome").toArray() : []),
    [hydrated],
    [],
  );
  const ingredientes = useLiveQuery(
    () => (hydrated ? db.ingredientes.orderBy("nome").toArray() : []),
    [hydrated],
    [],
  );

  const clienteMap = useMemo(
    () => new Map((clientes ?? []).map((c) => [c.id, c])),
    [clientes],
  );
  const receitaMap = useMemo(
    () => new Map((receitas ?? []).map((r) => [r.id, r])),
    [receitas],
  );
  const ingMap = useMemo(
    () => new Map((ingredientes ?? []).map((i) => [i.id, i])),
    [ingredientes],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Pedido | null>(null);
  const [toDelete, setToDelete] = useState<Pedido | null>(null);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await db.pedidos.delete(toDelete.id);
      toast.success("Pedido removido");
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
            <h1 className="truncate text-lg font-semibold text-foreground">Pedidos</h1>
            <p className="text-xs text-muted-foreground">
              {pedidos?.length ?? 0} encomendas
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4">
        {pedidos === undefined ? (
          <p className="py-10 text-center text-sm text-muted-foreground">A carregar…</p>
        ) : pedidos.length === 0 ? (
          <EmptyState onAdd={openNew} />
        ) : (
          <ul className="space-y-3">
            {pedidos.map((p) => {
              const totais = totaisPedido(p.itens, receitaMap, ingMap);
              return (
                <li
                  key={p.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-card-foreground">
                        {clienteMap.get(p.clienteId)?.nome ?? "Cliente removido"}
                      </h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Entrega {p.dataEntrega} · {p.itens.length} receita
                        {p.itens.length > 1 ? "s" : ""}
                      </p>
                      <Badge
                        variant={p.estado === "cancelado" ? "destructive" : "secondary"}
                        className="mt-2"
                      >
                        {estadoLabel[p.estado]}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10"
                        onClick={() => {
                          setEditing(p);
                          setFormOpen(true);
                        }}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-destructive hover:text-destructive"
                        onClick={() => setToDelete(p)}
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {p.itens.map((item, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="truncate">
                          {item.quantidade}× {receitaMap.get(item.receitaId)?.nome ?? "—"}
                        </span>
                        <span className="tabular-nums">
                          {formatEuro(item.quantidade * item.precoUnitario, {
                            compact: true,
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-sm">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Custo
                      </p>
                      <p className="font-medium tabular-nums text-foreground">
                        {formatEuro(totais.custo, { compact: true })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Lucro
                      </p>
                      <p className="font-medium tabular-nums text-foreground">
                        {formatEuro(totais.lucro, { compact: true })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Total
                      </p>
                      <p className="font-semibold tabular-nums text-foreground">
                        {formatEuro(totais.venda, { compact: true })}
                      </p>
                    </div>
                  </div>

                  {p.notas && (
                    <p className="mt-2 text-xs text-muted-foreground">{p.notas}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <Button onClick={openNew} className="h-14 w-full text-base">
            <Plus className="mr-2 h-5 w-5" />
            Novo pedido
          </Button>
        </div>
      </div>

      <PedidoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        pedido={editing}
        clientes={clientes ?? []}
        receitas={receitas ?? []}
        ingredientes={ingredientes ?? []}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
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

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-12 flex flex-col items-center text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-muted">
        <ClipboardList className="h-7 w-7 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">Ainda sem pedidos</h2>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Cria o primeiro pedido a juntar um cliente às receitas encomendadas.
      </p>
      <Button onClick={onAdd} className="mt-6 h-12">
        <Plus className="mr-2 h-4 w-4" />
        Novo pedido
      </Button>
    </div>
  );
}
