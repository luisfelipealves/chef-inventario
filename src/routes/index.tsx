import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Package, BookOpen, ChevronRight, Users, ClipboardList } from "lucide-react";
import { db } from "@/lib/db";
import { useHydrated } from "@/hooks/use-hydrated";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const hydrated = useHydrated();
  const totalIngredientes = useLiveQuery(
    () => (hydrated ? db.ingredientes.count() : 0),
    [hydrated],
    0,
  );
  const totalReceitas = useLiveQuery(
    () => (hydrated ? db.receitas.count() : 0),
    [hydrated],
    0,
  );
  const totalClientes = useLiveQuery(
    () => (hydrated ? db.clientes.count() : 0),
    [hydrated],
    0,
  );
  const totalPedidos = useLiveQuery(
    () => (hydrated ? db.pedidos.count() : 0),
    [hydrated],
    0,
  );


  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-8">
        <header className="text-center">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Local-first · Offline
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            ChefGestão
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gere ingredientes e calcula o custo das tuas receitas.
          </p>
        </header>

        <nav className="space-y-3">
          <ModuleCard
            to="/ingredientes"
            icon={<Package className="h-5 w-5" />}
            title="Ingredientes"
            subtitle={`${totalIngredientes} no stock`}
          />
          <ModuleCard
            to="/receitas"
            icon={<BookOpen className="h-5 w-5" />}
            title="Receitas"
            subtitle={`${totalReceitas} fichas técnicas`}
          />
          <ModuleCard
            to="/clientes"
            icon={<Users className="h-5 w-5" />}
            title="Clientes"
            subtitle={`${totalClientes} registados`}
          />
          <ModuleCard
            to="/pedidos"
            icon={<ClipboardList className="h-5 w-5" />}
            title="Pedidos"
            subtitle={`${totalPedidos} encomendas`}
          />
        </nav>
      </div>
    </main>
  );
}

function ModuleCard({
  to,
  icon,
  title,
  subtitle,
  disabled,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  disabled?: boolean;
}) {
  const content = (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-card-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </div>
  );

  if (disabled) {
    return <div className="pointer-events-none opacity-50">{content}</div>;
  }
  return <Link to={to}>{content}</Link>;
}
