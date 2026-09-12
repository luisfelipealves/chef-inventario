import { AvisoCusto, ResumoIndicadores } from "@/components/custos/ResumoIndicadores";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, ClipboardList, Plus, FileDown } from "lucide-react";
import { db, type Cliente, type Pedido } from "@/lib/db";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportarPedidoPdf, type TipoDocumento } from "@/lib/pedido-pdf";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useShell } from "@/lib/shell";
import { MobileDetail } from "@/components/lista/MobileDetail";
import { EstadoSelect } from "@/components/pedidos/EstadoSelect";
import { eliminarPedido } from "@/lib/producao";
import { FiltroBar, type FiltroOpcao } from "@/components/lista/FiltroBar";

export const Route = createFileRoute("/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos — Caderninho de Receitas" },
      {
        name: "description",
        content: "Junta clientes e receitas num pedido e calcula custo, lucro e valor final.",
      },
    ],
  }),
  component: PedidosPage,
});

const FILTROS_KEYS = [
  { key: "abertos", labelKey: "pedidos.filtroAbertos" },
  { key: "todos", labelKey: "pedidos.filtroTodos" },
  { key: "entregues", labelKey: "pedidos.filtroEntregues" },
  { key: "cancelados", labelKey: "pedidos.filtroCancelados" },
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
  const { t } = useTranslation();
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
  const isMobile = useIsMobile();
  const filtroAtual = filtro.pedidos;

  const lista = useMemo(() => pedidos ?? [], [pedidos]);
  const filtrados = useMemo(
    () => lista.filter((p) => passaFiltro(p, filtroAtual)),
    [lista, filtroAtual],
  );

  const selecionado = isMobile
    ? (filtrados.find((p) => p.id === selection.pedidos) ?? null)
    : (filtrados.find((p) => p.id === selection.pedidos) ?? filtrados[0] ?? null);

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
      await eliminarPedido(toDelete.id);
      toast.success(t("pedidos.removido"));
    } catch (err) {
      console.error(err);
      toast.error(t("pedidos.erroRemover"));
    } finally {
      setToDelete(null);
    }
  }

  return (
    <div className="lista-view" data-mobile-detail={isMobile && selecionado ? "true" : "false"}>
      <div className="lista-panel">
        <FiltroBar
          opcoes={FILTROS_KEYS.map((f): FiltroOpcao => ({ key: f.key, label: t(f.labelKey) }))}
          valor={filtroAtual}
          onChange={(k) => setFiltro("pedidos", k)}
          contagem={t("pedidos.contagem", { n: filtrados.length, total: lista.length })}
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
                  <th>{t("pedidos.thCliente")}</th>
                  <th>{t("pedidos.thEntrega")}</th>
                  <th>{t("pedidos.thItens")}</th>
                  <th className="num">{t("pedidos.thCusto")}</th>
                  <th className="num">{t("pedidos.thTotal")}</th>
                  <th>{t("pedidos.thEstado")}</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const totais = totaisPedido(p.itens, receitaMap, ingMap);
                  return (
                    <tr
                      key={p.id}
                      data-selected={selecionado?.id === p.id}
                      onClick={() => setSelection("pedidos", p.id)}
                    >
                      <td className="primeira" data-label={t("pedidos.thCliente")}>
                        {clienteMap.get(p.clienteId)?.nome ?? t("painel.clienteRemovido")}
                      </td>
                      <td data-label={t("pedidos.thEntrega")}>{dataEntregaCurta(p.dataEntrega)}</td>
                      <td data-label={t("pedidos.thItens")}>
                        {t("pedidos.nReceitas", { count: p.itens.length })}
                      </td>
                      <td
                        className="num"
                        data-label={t("pedidos.thCusto")}
                        title={totais.completo ? undefined : t("custos.incompleto")}
                      >
                        {totais.completo
                          ? formatEuro(totais.custo, { compact: true })
                          : t("custos.incompletoCurto")}
                      </td>
                      <td className="num" data-label={t("pedidos.thTotal")}>
                        {formatEuro(totais.venda, { compact: true })}
                      </td>
                      <td data-label={t("pedidos.thEstado")}>
                        <EstadoSelect pedido={p} />
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
          isMobile ? (
            <MobileDetail
              title={clienteMap.get(selecionado.clienteId)?.nome ?? t("painel.clienteRemovido")}
              backLabel={t("comum.voltar")}
              onBack={() => setSelection("pedidos", null)}
            >
              <PedidoDetalhe
                pedido={selecionado}
                clienteNome={
                  clienteMap.get(selecionado.clienteId)?.nome ?? t("painel.clienteRemovido")
                }
                cliente={clienteMap.get(selecionado.clienteId)}
                receitaMap={receitaMap}
                ingMap={ingMap}
                onEdit={() => openSheet({ module: "pedidos", mode: "editar", id: selecionado.id })}
                onDelete={() => setToDelete(selecionado)}
              />
            </MobileDetail>
          ) : (
            <PedidoDetalhe
              pedido={selecionado}
              clienteNome={
                clienteMap.get(selecionado.clienteId)?.nome ?? t("painel.clienteRemovido")
              }
              cliente={clienteMap.get(selecionado.clienteId)}
              receitaMap={receitaMap}
              ingMap={ingMap}
              onEdit={() => openSheet({ module: "pedidos", mode: "editar", id: selecionado.id })}
              onDelete={() => setToDelete(selecionado)}
            />
          )
        ) : (
          <div className="detalhe-empty">{t("pedidos.seleciona")}</div>
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
            <AlertDialogTitle>{t("pedidos.removerTitulo")}</AlertDialogTitle>
            <AlertDialogDescription>{t("comum.acaoIrreversivel")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-full">
              {t("comum.cancelar")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="h-11 rounded-full">
              {t("comum.remover")}
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
  cliente: Cliente | undefined;
  receitaMap: Map<number, import("@/lib/db").Receita>;
  ingMap: Map<number, import("@/lib/db").Ingrediente>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const totais = totaisPedido(pedido.itens, receitaMap, ingMap);

  async function exportarPdf(tipo: TipoDocumento) {
    try {
      const nome = await exportarPedidoPdf({ tipo, pedido, cliente, receitaMap });
      if (nome) toast.success(t("pedidos.pdfGuardado", { nome }));
    } catch (err) {
      console.error(err);
      toast.error(t("pedidos.erroPdf"));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <span className="card-kicker">{t("pedidos.kicker")}</span>
        <h3 style={{ fontSize: 25, margin: "2px 0 8px" }}>{clienteNome}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <EstadoSelect pedido={pedido} />
          <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
            {t("pedidos.entregaData", { data: dataEntregaLonga(pedido.dataEntrega) })}
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
                  {t("pedidos.porDose", {
                    preco: formatEuro(item.precoUnitario, { compact: true }),
                    unidade: receita?.unidadeRendimento ?? "un",
                    custo: formatEuro(custoDose, { compact: true }),
                  })}
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
          <span className="kv-label">{t("pedidos.custoProducao")}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatEuro(totais.custo, { compact: true })}
          </span>
        </div>
        <ResumoIndicadores
          resultado={totais.lucro}
          margem={totais.margem}
          acrescimo={totais.acrescimo}
        />
        <AvisoCusto completo={totais.completo} />
        <div style={{ borderTop: "1px solid var(--color-divider)", margin: "8px 0" }} />
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 15 }}>
            {t("pedidos.total")}
          </span>
          <span style={{ textAlign: "right" }}>
            <span
              style={{
                display: "block",
                fontFamily: "var(--font-heading)",
                fontSize: 21,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatEuro(totais.venda, { compact: true })}
            </span>
          </span>
        </div>
      </div>

      <div>
        <span className="card-kicker">{t("pedidos.notas")}</span>
        <p style={{ fontSize: 13, marginTop: 4, color: "var(--color-neutral-700)" }}>
          {pedido.notas || t("pedidos.semNotas")}
        </p>
      </div>

      <div>
        <span className="card-kicker">{t("pedidos.cliente")}</span>
        <p style={{ fontSize: 13, marginTop: 4, color: "var(--color-neutral-700)" }}>
          {[cliente?.telefone, cliente?.endereco].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>

      <div className="detalhe-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={onEdit}>
          <Pencil size={16} strokeWidth={2.75} />
          {t("pedidos.editarPedido")}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              aria-label={t("pedidos.exportarPdf")}
            >
              <FileDown size={16} strokeWidth={2.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void exportarPdf("orcamento")}>
              {t("pedidos.orcamentoPdf")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void exportarPdf("pedido")}>
              {t("pedidos.resumoPdf")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          onClick={onDelete}
          aria-label={t("pedidos.removerPedido")}
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
  const { t } = useTranslation();
  return (
    <div className="lista-empty">
      <div className="lista-empty-icon">
        <ClipboardList size={28} strokeWidth={2.75} />
      </div>
      <h2 style={{ fontSize: 20 }}>{t("pedidos.vazioTitulo")}</h2>
      <p style={{ fontSize: 14, color: "var(--color-neutral-600)", maxWidth: 320 }}>
        {t("pedidos.vazioDesc")}
      </p>
      <button type="button" className="btn btn-primary" onClick={onAdd}>
        <Plus size={16} strokeWidth={2.75} />
        {t("topbar.novoPedido")}
      </button>
    </div>
  );
}
