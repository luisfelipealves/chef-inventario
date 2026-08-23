import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, Users, Plus } from "lucide-react";
import { db, type Cliente, type Pedido } from "@/lib/db";
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
import { formatEuro } from "@/lib/format";
import { totaisPedido } from "@/lib/pedido-calc";
import { dataComAno } from "@/lib/data-format";
import { useHydrated } from "@/hooks/use-hydrated";
import { useShell } from "@/lib/shell";
import { EstadoTag } from "@/components/EstadoTag";
import { FiltroBar, type FiltroOpcao } from "@/components/lista/FiltroBar";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Caderninho de Receitas" },
      {
        name: "description",
        content:
          "Cadastro simples de clientes com nome, telefone, endereço e NIF, guardado no teu dispositivo.",
      },
    ],
  }),
  component: ClientesPage,
});

const FILTROS: FiltroOpcao[] = [
  { key: "todos", label: "Todos" },
  { key: "abertos", label: "Com pedidos abertos" },
];

function ClientesPage() {
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const clientes = useLiveQuery(
    () => (hydrated ? db.clientes.orderBy("nome").toArray() : []),
    [hydrated],
  );
  const pedidos = useLiveQuery(
    () => (hydrated ? db.pedidos.orderBy("dataEntrega").toArray() : []),
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

  const receitaMap = useMemo(() => new Map(receitas.map((r) => [r.id, r])), [receitas]);
  const ingMap = useMemo(() => new Map(ingredientes.map((i) => [i.id, i])), [ingredientes]);

  const pedidosPorCliente = useMemo(() => {
    const m = new Map<number, Pedido[]>();
    for (const p of pedidos) {
      const arr = m.get(p.clienteId);
      if (arr) arr.push(p);
      else m.set(p.clienteId, [p]);
    }
    return m;
  }, [pedidos]);

  const { filtro, setFiltro, selection, setSelection, sheet, closeSheet, openSheet } = useShell();
  const filtroAtual = filtro.clientes;

  const lista = useMemo(() => clientes ?? [], [clientes]);

  const filtrados = useMemo(() => {
    if (filtroAtual === "abertos") {
      return lista.filter((c) =>
        (pedidosPorCliente.get(c.id) ?? []).some(
          (p) => p.estado === "pendente" || p.estado === "confirmado",
        ),
      );
    }
    return lista;
  }, [lista, filtroAtual, pedidosPorCliente]);

  const selecionado = filtrados.find((c) => c.id === selection.clientes) ?? filtrados[0] ?? null;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [toDelete, setToDelete] = useState<Cliente | null>(null);

  useEffect(() => {
    if (sheet?.module !== "clientes") return;
    if (sheet.mode === "novo") {
      setEditing(null);
      setFormOpen(true);
    } else if (sheet.mode === "editar" && sheet.id != null) {
      setEditing(lista.find((c) => c.id === sheet.id) ?? null);
      setFormOpen(true);
    }
    closeSheet();
  }, [sheet, closeSheet, lista]);

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
    <div className="lista-view">
      <div className="lista-panel">
        <FiltroBar
          opcoes={FILTROS}
          valor={filtroAtual}
          onChange={(k) => setFiltro("clientes", k)}
          contagem={`${filtrados.length} de ${lista.length} clientes`}
        />

        {clientes === undefined ? (
          <SkeletonTabela />
        ) : lista.length === 0 ? (
          <EmptyState onAdd={() => openSheet({ module: "clientes", mode: "novo" })} />
        ) : (
          <div className="lista-table-wrap">
            <table className="lista-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>Endereço</th>
                  <th>NIF</th>
                  <th className="num">Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr
                    key={c.id}
                    data-selected={selecionado?.id === c.id}
                    onClick={() => setSelection("clientes", c.id)}
                  >
                    <td className="primeira">{c.nome}</td>
                    <td>{c.telefone || "—"}</td>
                    <td
                      style={{
                        maxWidth: 220,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.endereco || "—"}
                    </td>
                    <td>{c.nif || "—"}</td>
                    <td className="num">{(pedidosPorCliente.get(c.id) ?? []).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <aside className="detalhe-panel">
        {selecionado ? (
          <ClienteDetalhe
            cliente={selecionado}
            pedidos={pedidosPorCliente.get(selecionado.id) ?? []}
            receitaMap={receitaMap}
            ingMap={ingMap}
            onEdit={() => openSheet({ module: "clientes", mode: "editar", id: selecionado.id })}
            onDelete={() => setToDelete(selecionado)}
            onAbrirPedido={(id) => {
              setSelection("pedidos", id);
              navigate({ to: "/pedidos" });
            }}
          />
        ) : (
          <div className="detalhe-empty">Selecciona um cliente.</div>
        )}
      </aside>

      <ClienteFormDialog open={formOpen} onOpenChange={setFormOpen} cliente={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
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

function ClienteDetalhe({
  cliente,
  pedidos,
  receitaMap,
  ingMap,
  onEdit,
  onDelete,
  onAbrirPedido,
}: {
  cliente: Cliente;
  pedidos: Pedido[];
  receitaMap: Map<number, import("@/lib/db").Receita>;
  ingMap: Map<number, import("@/lib/db").Ingrediente>;
  onEdit: () => void;
  onDelete: () => void;
  onAbrirPedido: (id: number) => void;
}) {
  const historico = useMemo(
    () =>
      [...pedidos]
        .sort((a, b) => b.dataEntrega.localeCompare(a.dataEntrega))
        .map((p) => ({ pedido: p, total: totaisPedido(p.itens, receitaMap, ingMap).venda })),
    [pedidos, receitaMap, ingMap],
  );

  const totalEncomendado = historico.reduce((acc, h) => acc + h.total, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <span className="card-kicker">Cliente</span>
        <h3 style={{ fontSize: 25, margin: "2px 0" }}>{cliente.nome}</h3>
      </div>

      <div className="detalhe-card">
        <div className="kv">
          <span className="kv-label">Telefone</span>
          <span>{cliente.telefone || "—"}</span>
        </div>
        <div className="kv">
          <span className="kv-label">Endereço</span>
          <span style={{ textAlign: "right", maxWidth: 220 }}>{cliente.endereco || "—"}</span>
        </div>
        <div className="kv">
          <span className="kv-label">NIF</span>
          <span>{cliente.nif || "—"}</span>
        </div>
      </div>

      {historico.length > 0 && (
        <div>
          <span className="card-kicker">Histórico</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            {historico.map(({ pedido, total }) => (
              <button
                key={pedido.id}
                type="button"
                onClick={() => onAbrirPedido(pedido.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) auto auto",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 15px",
                  borderRadius: 18,
                  background: "var(--color-bg)",
                  border: 0,
                  cursor: "pointer",
                  color: "var(--color-text)",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 13 }}>{dataComAno(pedido.dataEntrega)}</span>
                <EstadoTag estado={pedido.estado} />
                <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {formatEuro(total, { compact: true })}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          background: "var(--color-accent-2-100)",
          color: "var(--color-accent-2-800)",
          borderRadius: 22,
          padding: "16px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 13 }}>Total encomendado</span>
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 19,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatEuro(totalEncomendado, { compact: true })}
        </span>
      </div>

      <div className="detalhe-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={onEdit}>
          <Pencil size={16} strokeWidth={2.75} />
          Editar cliente
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          onClick={onDelete}
          aria-label="Remover cliente"
        >
          <Trash2 size={16} strokeWidth={2.75} />
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
        <Users size={28} strokeWidth={2.75} />
      </div>
      <h2 style={{ fontSize: 20 }}>Ainda sem clientes</h2>
      <p style={{ fontSize: 14, color: "var(--color-neutral-600)", maxWidth: 320 }}>
        Regista o nome, telefone, endereço e NIF dos teus clientes para encomendas futuras.
      </p>
      <button type="button" className="btn btn-primary" onClick={onAdd}>
        <Plus size={16} strokeWidth={2.75} />
        Novo cliente
      </button>
    </div>
  );
}
