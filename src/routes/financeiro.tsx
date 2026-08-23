import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState, type CSSProperties } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { db, type Compra, type Pedido } from "@/lib/db";
import { formatEuro } from "@/lib/format";
import { totaisPedido, estadoLabel } from "@/lib/pedido-calc";
import { parseData } from "@/lib/data-format";
import { useHydrated } from "@/hooks/use-hydrated";
import { FiltroBar, type FiltroOpcao } from "@/components/lista/FiltroBar";
import { exportarFinanceiroCsv, type MovimentoCsv } from "@/lib/financeiro-csv";
import type { Cliente, EstadoPedido, Ingrediente, Receita } from "@/lib/db";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — ChefGestão" },
      {
        name: "description",
        content: "Receita, gastos e lucro por período, com gráficos simples.",
      },
    ],
  }),
  component: FinanceiroPage,
});

const DIA_MS = 24 * 60 * 60 * 1000;

const PERIODOS: FiltroOpcao[] = [
  { key: "este-mes", label: "Este mês" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "este-ano", label: "Este ano" },
  { key: "perso", label: "Personalizado" },
];

function hoje(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function fimDoDia(d: Date): Date {
  const f = new Date(d);
  f.setHours(23, 59, 59, 999);
  return f;
}

function periodoDe(preset: string, de: string, ate: string): { inicio: Date; fim: Date } {
  const h = hoje();
  switch (preset) {
    case "30d": {
      const i = new Date(h);
      i.setDate(i.getDate() - 29);
      return { inicio: i, fim: fimDoDia(h) };
    }
    case "90d": {
      const i = new Date(h);
      i.setDate(i.getDate() - 89);
      return { inicio: i, fim: fimDoDia(h) };
    }
    case "este-ano":
      return { inicio: new Date(h.getFullYear(), 0, 1), fim: fimDoDia(h) };
    case "perso": {
      const i = parseData(de) ?? new Date(h.getFullYear(), h.getMonth(), 1);
      const f = parseData(ate) ?? h;
      return i <= f ? { inicio: i, fim: fimDoDia(f) } : { inicio: f, fim: fimDoDia(i) };
    }
    default:
      return { inicio: new Date(h.getFullYear(), h.getMonth(), 1), fim: fimDoDia(h) };
  }
}

function mesCurto(d: Date): string {
  return new Intl.DateTimeFormat("pt-PT", { month: "short" }).format(d).replace(".", "");
}

interface Ponto {
  chave: string;
  label: string;
  receita: number;
  gastos: number;
}

function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function chaveMes(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/** Série temporal receita vs gastos: por dia até ~2 meses, por mês acima disso. */
function construirSerie(
  inicio: Date,
  fim: Date,
  pedidos: { data: Date; venda: number }[],
  compras: { data: Date; valor: number }[],
): Ponto[] {
  const dias = Math.round((fim.getTime() - inicio.getTime()) / DIA_MS) + 1;
  const porDia = dias <= 62;
  const chaveDe = porDia ? chaveDia : chaveMes;

  const pontos: Ponto[] = [];
  const index = new Map<string, Ponto>();
  const cursor = new Date(inicio);
  while (cursor <= fim) {
    const chave = chaveDe(cursor);
    if (!index.has(chave)) {
      const p: Ponto = {
        chave,
        label: porDia
          ? `${cursor.getDate()} ${mesCurto(cursor)}`
          : `${mesCurto(cursor)} ${String(cursor.getFullYear()).slice(2)}`,
        receita: 0,
        gastos: 0,
      };
      index.set(chave, p);
      pontos.push(p);
    }
    if (porDia) cursor.setDate(cursor.getDate() + 1);
    else cursor.setMonth(cursor.getMonth() + 1, 1);
  }

  for (const p of pedidos) {
    const ponto = index.get(chaveDe(p.data));
    if (ponto) ponto.receita += p.venda;
  }
  for (const c of compras) {
    const ponto = index.get(chaveDe(c.data));
    if (ponto) ponto.gastos += c.valor;
  }
  return pontos;
}

const ESTILO_INPUT_DATA: CSSProperties = {
  height: 34,
  fontSize: 13,
  padding: "0 12px",
  borderRadius: 999,
  background: "var(--color-surface)",
  border: "1px solid var(--color-divider)",
  fontFamily: "inherit",
  color: "var(--color-text)",
};

const COR_ESTADO: Record<EstadoPedido, string> = {
  pendente: "var(--color-neutral-400)",
  confirmado: "var(--color-accent-2-500)",
  entregue: "var(--color-accent-500)",
  cancelado: "var(--color-neutral-300)",
};

function FinanceiroPage() {
  const hydrated = useHydrated();
  const pedidos = useLiveQuery(() => (hydrated ? db.pedidos.toArray() : []), [hydrated], []);
  const compras = useLiveQuery(() => (hydrated ? db.compras.toArray() : []), [hydrated], []);
  const receitas = useLiveQuery(() => (hydrated ? db.receitas.toArray() : []), [hydrated], []);
  const ingredientes = useLiveQuery(
    () => (hydrated ? db.ingredientes.toArray() : []),
    [hydrated],
    [],
  );
  const clientes = useLiveQuery(() => (hydrated ? db.clientes.toArray() : []), [hydrated], []);

  const clienteMap = useMemo(
    () => new Map<number, Cliente>(clientes.map((c) => [c.id, c])),
    [clientes],
  );
  const receitaMap = useMemo(
    () => new Map<number, Receita>(receitas.map((r) => [r.id, r])),
    [receitas],
  );
  const ingMap = useMemo(
    () => new Map<number, Ingrediente>(ingredientes.map((i) => [i.id, i])),
    [ingredientes],
  );

  const [preset, setPreset] = useState("este-mes");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const { inicio, fim } = useMemo(() => periodoDe(preset, de, ate), [preset, de, ate]);

  const dados = useMemo(() => {
    const noPeriodo = (d: Date | null) => d !== null && d >= inicio && d <= fim;

    const pedidosPeriodo: { pedido: Pedido; data: Date; venda: number; custo: number }[] = [];
    for (const p of pedidos) {
      const data = parseData(p.dataEntrega);
      if (!noPeriodo(data)) continue;
      const t = totaisPedido(p.itens, receitaMap, ingMap);
      pedidosPeriodo.push({ pedido: p, data: data as Date, venda: t.venda, custo: t.custo });
    }
    const ativos = pedidosPeriodo.filter((p) => p.pedido.estado !== "cancelado");

    const comprasPeriodo: (Compra & { data: Date })[] = [];
    for (const c of compras) {
      const data = c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt);
      if (noPeriodo(data)) comprasPeriodo.push({ ...c, data });
    }

    const receita = ativos.reduce((s, p) => s + p.venda, 0);
    const custoProducao = ativos.reduce((s, p) => s + p.custo, 0);
    const gastos = comprasPeriodo.reduce((s, c) => s + c.valor, 0);

    const porEstado = new Map<EstadoPedido, number>();
    for (const { pedido } of pedidosPeriodo) {
      porEstado.set(pedido.estado, (porEstado.get(pedido.estado) ?? 0) + 1);
    }

    return {
      serie: construirSerie(
        inicio,
        fim,
        ativos.map((p) => ({ data: p.data, venda: p.venda })),
        comprasPeriodo.map((c) => ({ data: c.data, valor: c.valor })),
      ),
      receita,
      custoProducao,
      gastos,
      lucro: receita - custoProducao,
      nPedidos: ativos.length,
      nCompras: comprasPeriodo.length,
      ticketMedio: ativos.length > 0 ? receita / ativos.length : 0,
      estados: [...porEstado.entries()].map(([estado, n]) => ({
        estado,
        nome: estadoLabel[estado],
        n,
      })),
      ultimasCompras: [...comprasPeriodo]
        .sort((a, b) => b.data.getTime() - a.data.getTime())
        .slice(0, 8),
      movimentos: [
        ...ativos.map((p): MovimentoCsv => ({
          data: p.data,
          tipo: "Receita",
          descricao: `Pedido nº ${p.pedido.id} — ${p.pedido.itens
            .map((i) => `${i.quantidade}× ${receitaMap.get(i.receitaId)?.nome ?? "?"}`)
            .join(", ")}`,
          contraparte: clienteMap.get(p.pedido.clienteId)?.nome ?? "",
          estado: estadoLabel[p.pedido.estado],
          valor: p.venda,
        })),
        ...comprasPeriodo.map((c): MovimentoCsv => ({
          data: c.data,
          tipo: "Despesa",
          descricao: `${c.nome} (${c.quantidade} ${c.unidade})`,
          contraparte: "",
          estado: "",
          valor: c.valor,
        })),
      ],
    };
  }, [pedidos, compras, receitaMap, ingMap, clienteMap, inicio, fim]);

  async function exportarCsv() {
    if (dados.movimentos.length === 0) {
      toast.info("Sem movimentos no período para exportar.");
      return;
    }
    try {
      const nome = await exportarFinanceiroCsv(dados.movimentos, inicio, fim);
      if (nome) toast.success(`CSV exportado: ${nome}`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao exportar o CSV.");
    }
  }

  return (
    <div style={{ padding: "4px 28px 28px", overflowY: "auto", flex: 1 }}>
      <FiltroBar
        opcoes={PERIODOS}
        valor={preset}
        onChange={setPreset}
        contagem={`${dados.nPedidos} pedidos · ${dados.nCompras} compras`}
        acao={
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {preset === "perso" && (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="date"
                  value={de}
                  onChange={(e) => setDe(e.target.value)}
                  style={ESTILO_INPUT_DATA}
                />
                <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>a</span>
                <input
                  type="date"
                  value={ate}
                  onChange={(e) => setAte(e.target.value)}
                  style={ESTILO_INPUT_DATA}
                />
              </span>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void exportarCsv()}
              style={{ height: 34, fontSize: 13 }}
            >
              <FileDown size={15} strokeWidth={2.75} />
              Exportar CSV
            </button>
          </span>
        }
      />

      {/* Indicadores do período */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <Indicador
          kicker="Receita"
          valor={formatEuro(dados.receita, { compact: true })}
          nota={`${dados.nPedidos} pedidos · ticket ${formatEuro(dados.ticketMedio, { compact: true })}`}
        />
        <Indicador
          kicker="Gastos em compras"
          valor={formatEuro(dados.gastos, { compact: true })}
          nota="valor pago em ingredientes"
        />
        <Indicador
          kicker="Custo de produção"
          valor={formatEuro(dados.custoProducao, { compact: true })}
          nota="teórico, pelos pedidos"
        />
        <Indicador
          kicker="Lucro estimado"
          valor={formatEuro(dados.lucro, { compact: true })}
          nota="receita − custo de produção"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.35fr 1fr",
          gap: 16,
          alignItems: "start",
          marginTop: 16,
        }}
      >
        {/* Receita vs gastos ao longo do período */}
        <section
          style={{
            background: "var(--color-surface)",
            borderRadius: 32,
            padding: 22,
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h4 style={{ fontSize: 20 }}>Receita vs. gastos</h4>
          <div style={{ height: 280, marginTop: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados.serie} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-divider)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v: number | string, nome: string) => [
                    formatEuro(Number(v), { compact: true }),
                    nome === "receita" ? "Receita" : "Gastos",
                  ]}
                  cursor={{ fill: "var(--color-neutral-100)" }}
                />
                <Bar dataKey="receita" fill="var(--color-accent-2-500)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="gastos" fill="var(--color-accent-500)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <LegendaCor cor="var(--color-accent-2-500)" label="Receita (pedidos)" />
            <LegendaCor cor="var(--color-accent-500)" label="Gastos (compras)" />
          </div>
        </section>

        {/* Coluna direita: estados + últimas compras */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section
            style={{
              background: "var(--color-surface)",
              borderRadius: 32,
              padding: 22,
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <h4 style={{ fontSize: 20 }}>Pedidos por estado</h4>
            {dados.estados.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-neutral-600)", marginTop: 8 }}>
                Sem pedidos no período.
              </p>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 150, height: 150 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dados.estados}
                        dataKey="n"
                        nameKey="nome"
                        innerRadius={42}
                        outerRadius={66}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {dados.estados.map((e) => (
                          <Cell key={e.estado} fill={COR_ESTADO[e.estado]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number | string) => [String(v), "pedidos"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  {dados.estados.map((e) => (
                    <div
                      key={e.estado}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <LegendaCor cor={COR_ESTADO[e.estado]} label={e.nome} />
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {e.n}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section
            style={{
              background: "var(--color-surface)",
              borderRadius: 32,
              padding: 22,
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <h4 style={{ fontSize: 20 }}>Últimas compras</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
              {dados.ultimasCompras.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
                  Sem compras registadas no período. As compras passam a ficar no histórico a partir
                  de agora — via "Adicionar compra" ou importação de fatura.
                </p>
              ) : (
                dados.ultimasCompras.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "9px 14px",
                      borderRadius: 16,
                      background: "var(--color-neutral-100)",
                    }}
                  >
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
                        {c.nome}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
                        {c.data.getDate()} {mesCurto(c.data)} · {c.quantidade} {c.unidade}
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatEuro(c.valor, { compact: true })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Indicador({ kicker, valor, nota }: { kicker: string; valor: string; nota: string }) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: 32,
        padding: 13.2,
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span className="card-kicker">{kicker}</span>
      <span
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 30,
          lineHeight: 1.15,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {valor}
      </span>
      <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>{nota}</span>
    </div>
  );
}

function LegendaCor({ cor, label }: { cor: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
      <span
        style={{ width: 10, height: 10, borderRadius: 3, background: cor, display: "inline-block" }}
      />
      {label}
    </span>
  );
}
