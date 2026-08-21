import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, ClipboardList, Plus } from "lucide-react";
import { db, type Pedido } from "@/lib/db";
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
import { totaisPedido, custoDoseReceita } from "@/lib/pedido-calc";
import { dataEntregaCurta, dataEntregaLonga } from "@/lib/data-format";
import { useHydrated } from "@/hooks/use-hydrated";
import { useShell } from "@/lib/shell";
import { EstadoTag } from "@/components/EstadoTag";
import { FiltroBar, type FiltroOpcao } from "@/components/lista/FiltroBar";

export const Route = createFileRoute("/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos — ChefGestão" },
      {
        name: "description",
        content: "Junta clientes e receitas num pedido e calcula custo, lucro e valor final.",
      },
    ],
  }),
  component: PedidosPage,
});

const FILTROS: FiltroOpcao[] = [
  { key: "abertos", label: "Abertos" },
  { key: "todos", label: "Todos" },
  { key: "entregues", label: "Entregues" },
  { key: "cancelados", label: "Cancelados" },
];

function passaFiltro(p: Pedido, filtro: string): boolean {
  switch (filtro) {
    case "abertos":
      return p.estado === "pendente" || p.estado === "confirmado";
    case "entregues":
      return p.estado === "entregue";
    case "cancelados":
      return p.estado === "cancelado";
    default:
      return true;
  }
}

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

  const clienteMap = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const receitaMap = useMemo(() => new Map(receitas.map((r) => [r.id, r])), [receitas]);
  const ingMap = useMemo(() => new Map(ingredientes.map((i) => [i.id, i])), [ingredientes]);

  const { filtro, setFiltro, selection, setSelection, sheet, closeSheet, openSheet } = useShell();
  const filtroAtual = filtro.pedidos;

  const lista = useMemo(() => pedidos ?? [], [pedidos]);
  const filtrados = useMemo(
    () => lista.filter((p) => passaFiltro(p, filtroAtual)),
    [lista, filtroAtual],
  );

  const selecionado = filtrados.find((p) => p.id === selection.pedidos) ?? filtrados[0] ?? null;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Pedido | null>(null);
  const [toDelete, setToDelete] = useState<Pedido | null>(null);

  // Botão "Novo pedido" / "Editar pedido" da barra de topo / detalhe.
  useEffect(() => {
    if (sheet?.module !== "pedidos") return;
    if (sheet.mode === "novo") {
      setEditing(null);
      setFormOpen(true);
    } else if (sheet.mode === "editar" && sheet.id != null) {
      setEditing(lista.find((p) => p.id === sheet.id) ?? null);
      setFormOpen(true);
    }
    closeSheet();
  }, [sheet, closeSheet, lista]);

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
    <div className="lista-view">
      <div className="lista-panel">
        <FiltroBar
          opcoes={FILTROS}
          valor={filtroAtual}
          onChange={(k) => setFiltro("pedidos", k)}
          contagem={`${filtrados.length} de ${lista.length} pedidos`}
        />

        {pedidos === undefined ? (
          <SkeletonTabela />
        ) : lista.length === 0 ? (
          <EmptyState onAdd={() => openSheet({ module: "pedidos", mode: "novo" })} />
        ) : (
          <div className="lista-table-wrap">
            <table className="lista-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Entrega</th>
                  <th>Itens</th>
                  <th className="num">Custo</th>
                  <th className="num">Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const t = totaisPedido(p.itens, receitaMap, ingMap);
                  return (
                    <tr
                      key={p.id}
                      data-selected={selecionado?.id === p.id}
                      onClick={() => setSelection("pedidos", p.id)}
                    >
                      <td className="primeira">
                        {clienteMap.get(p.clienteId)?.nome ?? "Cliente removido"}
                      </td>
                      <td>{dataEntregaCurta(p.dataEntrega)}</td>
                      <td>
                        {p.itens.length} receita{p.itens.length === 1 ? "" : "s"}
                      </td>
                      <td className="num">{formatEuro(t.custo, { compact: true })}</td>
                      <td className="num">{formatEuro(t.venda, { compact: true })}</td>
                      <td>
                        <EstadoTag estado={p.estado} />
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
          <PedidoDetalhe
            pedido={selecionado}
            clienteNome={clienteMap.get(selecionado.clienteId)?.nome ?? "Cliente removido"}
            cliente={clienteMap.get(selecionado.clienteId)}
            receitaMap={receitaMap}
            ingMap={ingMap}
            onEdit={() => openSheet({ module: "pedidos", mode: "editar", id: selecionado.id })}
            onDelete={() => setToDelete(selecionado)}
          />
        ) : (
          <div className="detalhe-empty">Selecciona um pedido.</div>
        )}
      </aside>

      <PedidoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        pedido={editing}
        clientes={clientes}
        receitas={receitas}
        ingredientes={ingredientes}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover pedido?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
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

function PedidoDetalhe({
  pedido,
  clienteNome,
  cliente,
  receitaMap,
  ingMap,
  onEdit,
  onDelete,
}: {
  pedido: Pedido;
  clienteNome: string;
  cliente: { telefone: string; endereco: string } | undefined;
  receitaMap: Map<number, import("@/lib/db").Receita>;
  ingMap: Map<number, import("@/lib/db").Ingrediente>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = totaisPedido(pedido.itens, receitaMap, ingMap);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <span className="card-kicker">Pedido</span>
        <h3 style={{ fontSize: 25, margin: "2px 0 8px" }}>{clienteNome}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <EstadoTag estado={pedido.estado} />
          <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
            Entrega {dataEntregaLonga(pedido.dataEntrega)}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pedido.itens.map((item, i) => {
          const receita = receitaMap.get(item.receitaId);
          const custoDose = custoDoseReceita(receita, ingMap);
          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "32px minmax(0,1fr) auto",
                gap: 12,
                padding: "11px 14px",
                borderRadius: 18,
                background: "var(--color-bg)",
                alignItems: "center",
              }}
            >
              <span style={{ fontFamily: "var(--font-heading)", fontSize: 15 }}>
                {item.quantidade}×
              </span>
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {receita?.nome ?? "Receita removida"}
                </span>
                <span style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
                  {formatEuro(item.precoUnitario, { compact: true })} por dose · custo{" "}
                  {formatEuro(custoDose, { compact: true })}
                </span>
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {formatEuro(item.precoUnitario * item.quantidade, { compact: true })}
              </span>
            </div>
          );
        })}
      </div>

      <div className="detalhe-card">
        <div className="kv">
          <span className="kv-label">Custo de produção</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatEuro(t.custo, { compact: true })}
          </span>
        </div>
        <div className="kv">
          <span className="kv-label">Lucro</span>
          <span
            style={{
              color: "var(--color-accent-2-700)",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatEuro(t.lucro, { compact: true })}
          </span>
        </div>
        <div style={{ borderTop: "1px solid var(--color-divider)", margin: "8px 0" }} />
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 15 }}>Total</span>
          <span style={{ textAlign: "right" }}>
            <span
              style={{
                display: "block",
                fontFamily: "var(--font-heading)",
                fontSize: 21,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatEuro(t.venda, { compact: true })}
            </span>
            <span style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
              margem +{Math.round(t.margem)}%
            </span>
          </span>
        </div>
      </div>

      <div>
        <span className="card-kicker">Notas</span>
        <p style={{ fontSize: 13, marginTop: 4, color: "var(--color-neutral-700)" }}>
          {pedido.notas || "Sem notas."}
        </p>
      </div>

      <div>
        <span className="card-kicker">Cliente</span>
        <p style={{ fontSize: 13, marginTop: 4, color: "var(--color-neutral-700)" }}>
          {[cliente?.telefone, cliente?.endereco].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>

      <div className="detalhe-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={onEdit}>
          <Pencil size={16} strokeWidth={2.75} />
          Editar pedido
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          onClick={onDelete}
          aria-label="Remover pedido"
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
        <ClipboardList size={28} strokeWidth={2.75} />
      </div>
      <h2 style={{ fontSize: 20 }}>Ainda sem pedidos</h2>
      <p style={{ fontSize: 14, color: "var(--color-neutral-600)", maxWidth: 320 }}>
        Cria o primeiro pedido a juntar um cliente às receitas encomendadas.
      </p>
      <button type="button" className="btn btn-primary" onClick={onAdd}>
        <Plus size={16} strokeWidth={2.75} />
        Novo pedido
      </button>
    </div>
  );
}
