import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import {
  Package,
  BookOpen,
  ChevronRight,
  Users,
  ClipboardList,
  CalendarDays,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { formatEuro } from "@/lib/format";
import { useHydrated } from "@/hooks/use-hydrated";
import { estadoLabel, totaisPedido } from "@/lib/pedido-calc";


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
  const pedidos = useLiveQuery(
    () =>
      hydrated
        ? db.pedidos
            .filter((p) => p.estado === "pendente" || p.estado === "confirmado")
            .sortBy("dataEntrega")
        : [],
    [hydrated],
    [],
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

        {(pedidos ?? []).length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Pedidos abertos
              </h2>
              <Link
                to="/pedidos"
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver todos
              </Link>
            </div>
            <ul className="space-y-2">
              {pedidos.map((p) => {
                const totais = totaisPedido(p.itens, receitaMap, ingMap);
                const cliente = clienteMap.get(p.clienteId);
                return (
                  <li key={p.id}>
                    <Link
                      to="/pedidos"
                      className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-card-foreground">
                            {cliente?.nome ?? "Cliente removido"}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              Entrega {p.dataEntrega}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {p.itens.length} receita
                              {p.itens.length > 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <Badge
                            variant={
                              p.estado === "pendente" ? "outline" : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {estadoLabel[p.estado]}
                          </Badge>
                          <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                            {formatEuro(totais.venda, { compact: true })}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
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
