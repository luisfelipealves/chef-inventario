import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const totalIngredientes = useLiveQuery(() => db.ingredientes.count(), [], 0);
  const totalReceitas = useLiveQuery(() => db.receitas.count(), [], 0);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <div>
          <p className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
            Fase 1 · Fundação
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground">
            ChefGestão
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Base de dados local (IndexedDB via Dexie) ativa. Os teus dados ficam no dispositivo.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Ingredientes</p>
            <p className="mt-1 text-2xl font-semibold text-card-foreground">
              {totalIngredientes}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Receitas</p>
            <p className="mt-1 text-2xl font-semibold text-card-foreground">
              {totalReceitas}
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Infraestrutura pronta. As interfaces de gestão chegam na próxima fase.
        </p>
      </div>
    </main>
  );
}
