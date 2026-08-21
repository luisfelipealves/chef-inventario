import { useEffect, useMemo, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocation } from "@tanstack/react-router";
import { db } from "@/lib/db";
import { useHydrated } from "@/hooks/use-hydrated";
import { calcularAlertasStock } from "@/lib/stock-alerta";
import { useShell, type ModuloLista } from "@/lib/shell";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const { pathname } = useLocation();
  const { setQuery } = useShell();

  // Pesquisa global limpa ao navegar.
  useEffect(() => setQuery(""), [pathname, setQuery]);

  const ingredientes = useLiveQuery(
    () => (hydrated ? db.ingredientes.orderBy("nome").toArray() : []),
    [hydrated],
    [],
  );
  const receitas = useLiveQuery(
    () => (hydrated ? db.receitas.orderBy("nome").toArray() : []),
    [hydrated],
    [],
  );
  const clientes = useLiveQuery(
    () => (hydrated ? db.clientes.orderBy("nome").toArray() : []),
    [hydrated],
    [],
  );
  const pedidos = useLiveQuery(
    () => (hydrated ? db.pedidos.orderBy("dataEntrega").toArray() : []),
    [hydrated],
    [],
  );

  const clienteMap = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const receitaMap = useMemo(() => new Map(receitas.map((r) => [r.id, r])), [receitas]);
  const ingMap = useMemo(() => new Map(ingredientes.map((i) => [i.id, i])), [ingredientes]);

  const alertas = useMemo(
    () => calcularAlertasStock(ingredientes, receitas, pedidos),
    [ingredientes, receitas, pedidos],
  );

  const counts: Record<ModuloLista, number> = {
    pedidos: pedidos.length,
    receitas: receitas.length,
    ingredientes: ingredientes.length,
    clientes: clientes.length,
  };

  const datasets = {
    ingredientes,
    receitas,
    clientes,
    pedidos,
    clienteMap,
    receitaMap,
    ingMap,
  };

  return (
    <div className="shell-root">
      <Sidebar counts={counts} alertas={alertas} />
      <div className="shell-main">
        <Topbar datasets={datasets} />
        <div className="shell-content">{children}</div>
      </div>
    </div>
  );
}
