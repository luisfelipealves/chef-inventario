import { AvisoCusto } from "@/components/custos/ResumoIndicadores";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation, type UseTranslationResponse } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { TriangleAlert } from "lucide-react";
import { db } from "@/lib/db";
import { formatEuro } from "@/lib/format";
import { useHydrated } from "@/hooks/use-hydrated";
import { totaisPedido } from "@/lib/pedido-calc";
import { resumoReceita } from "@/lib/receita-custo";
import { calcularAlertasStock } from "@/lib/stock-alerta";
import { useShell } from "@/lib/shell";
import { EstadoTag } from "@/components/EstadoTag";
import { localeAtual } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  component: Painel,
});

const DIA_MS = 24 * 60 * 60 * 1000;

type T = UseTranslationResponse<"translation", undefined>["t"];

function nomeMes(d: Date): string {
  return new Intl.DateTimeFormat(localeAtual(), { month: "long" }).format(d);
}
function mesCurto(d: Date): string {
  return new Intl.DateTimeFormat(localeAtual(), { month: "short" }).format(d).replace(".", "");
}

function intervaloDatas(datas: Date[], t: T): string {
  if (datas.length === 0) return t("painel.semEntregas");
  const min = datas[0];
  const max = datas[datas.length - 1];
  if (min.getTime() === max.getTime()) {
    return t("painel.umDia", { dia: min.getDate(), mes: nomeMes(min) });
  }
  if (min.getMonth() === max.getMonth()) {
    return t("painel.intervaloMesmoMes", {
      de: min.getDate(),
      ate: max.getDate(),
      mes: nomeMes(min),
    });
  }
  return t("painel.intervaloDoisMeses", {
    de: min.getDate(),
    mesDe: mesCurto(min),
    ate: max.getDate(),
    mesAte: mesCurto(max),
  });
}

function Painel() {
  const { t } = useTranslation();
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const { setSelection } = useShell();

  const pedidos = useLiveQuery(
    () => (hydrated ? db.pedidos.orderBy("dataEntrega").toArray() : []),
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

  const clienteMap = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const receitaMap = useMemo(() => new Map(receitas.map((r) => [r.id, r])), [receitas]);
  const ingMap = useMemo(() => new Map(ingredientes.map((i) => [i.id, i])), [ingredientes]);

  const abertos = useMemo(
    () => pedidos.filter((p) => p.estado === "pendente" || p.estado === "confirmado"),
    [pedidos],
  );

  const alertas = useMemo(
    () => calcularAlertasStock(ingredientes, receitas, pedidos),
    [ingredientes, receitas, pedidos],
  );

  const resumo = useMemo(() => {
    let aReceber = 0;
    let lucro = 0;
    for (const p of abertos) {
      const totais = totaisPedido(p.itens, receitaMap, ingMap);
      aReceber += totais.venda;
      lucro += totais.lucro;
    }

    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(inicio.getTime() + 7 * DIA_MS);
    const semana = abertos
      .map((p) => new Date(`${p.dataEntrega}T00:00:00`))
      .filter((d) => !Number.isNaN(d.getTime()) && d >= inicio && d <= fim)
      .sort((a, b) => a.getTime() - b.getTime());

    return {
      aReceber,
      lucro,
      semanaCount: semana.length,
      semanaIntervalo: intervaloDatas(semana, t),
    };
  }, [abertos, receitaMap, ingMap, t]);

  const topReceitas = useMemo(() => {
    return receitas
      .filter((r) => (r.precoVenda ?? 0) > 0)
      .map((r) => {
        const resumo = resumoReceita(r, ingMap);
        return { receita: r, margem: resumo.margem };
      })
      .filter((r): r is { receita: typeof r.receita; margem: number } => r.margem != null)
      .sort((a, b) => b.margem - a.margem)
      .slice(0, 3);
  }, [receitas, ingMap]);

  function abrirPedido(id: number) {
    setSelection("pedidos", id);
    navigate({ to: "/pedidos" });
  }
  function abrirIngrediente(id: number) {
    setSelection("ingredientes", id);
    navigate({ to: "/ingredientes" });
  }

  return (
    <div
      className="dashboard-page"
      style={{ padding: "4px 28px 28px", overflowY: "auto", flex: 1 }}
    >
      {/* Faixa de indicadores */}
      <div
        className="dashboard-indicators"
        style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}
      >
        <Indicador
          kicker={t("painel.pedidosAbertos")}
          valor={String(abertos.length)}
          nota={t("painel.aReceber", { valor: formatEuro(resumo.aReceber, { compact: true }) })}
        />
        <Indicador
          kicker={t("painel.entregarSemana")}
          valor={String(resumo.semanaCount)}
          nota={resumo.semanaIntervalo}
        />
        <Indicador
          kicker={t("painel.lucroPrevisto")}
          valor={formatEuro(resumo.lucro, { compact: true })}
          nota={
            Number.isFinite(resumo.lucro) ? t("painel.sobrePedidosAbertos") : t("custos.incompleto")
          }
        />
        <Indicador
          kicker={t("painel.ingredientesStock")}
          valor={String(ingredientes.length)}
          nota={t("painel.abaixoNecessario", { n: alertas.length })}
        />
      </div>

      {/* Grid principal */}
      <div
        className="dashboard-main-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1.35fr 1fr",
          gap: 16,
          alignItems: "start",
          marginTop: 16,
        }}
      >
        {/* Próximas entregas */}
        <section
          style={{
            background: "var(--color-surface)",
            borderRadius: 32,
            padding: 22,
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h4 style={{ fontSize: 20 }}>{t("painel.proximasEntregas")}</h4>
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: 13, background: "none", border: 0, cursor: "pointer" }}
              onClick={() => navigate({ to: "/pedidos" })}
            >
              {t("painel.verPedidos")}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
            {abertos.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-neutral-600)", padding: "12px 0" }}>
                {t("painel.semPedidosAbertos")}
              </p>
            ) : (
              abertos.map((p) => {
                const totais = totaisPedido(p.itens, receitaMap, ingMap);
                const d = new Date(`${p.dataEntrega}T00:00:00`);
                const itensStr = p.itens
                  .map((i) => `${i.quantidade}× ${receitaMap.get(i.receitaId)?.nome ?? "—"}`)
                  .join(", ");
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => abrirPedido(p.id)}
                    className="dashboard-delivery-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "62px minmax(0,1fr) auto auto",
                      alignItems: "center",
                      gap: 16,
                      padding: "12px 14px",
                      borderRadius: 20,
                      background: "var(--color-neutral-100)",
                      border: 0,
                      cursor: "pointer",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    <span>
                      <span
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontSize: 19,
                          display: "block",
                        }}
                      >
                        {Number.isNaN(d.getTime()) ? "—" : d.getDate()}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          color: "var(--color-neutral-600)",
                        }}
                      >
                        {Number.isNaN(d.getTime()) ? "" : mesCurto(d)}
                      </span>
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 14,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {clienteMap.get(p.clienteId)?.nome ?? t("painel.clienteRemovido")}
                      </span>
                      <span
                        style={{
                          display: "block",
                          fontSize: 12,
                          color: "var(--color-neutral-600)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {itensStr}
                      </span>
                    </span>
                    <EstadoTag estado={p.estado} />
                    <span
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: 16,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatEuro(totais.venda, { compact: true })}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Coluna direita */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {alertas.length > 0 && (
            <section
              style={{
                background: "var(--color-accent-100)",
                color: "var(--color-accent-800)",
                padding: 22,
                borderRadius: 32,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TriangleAlert size={18} strokeWidth={2.75} />
                <h4 style={{ fontSize: 20, color: "inherit" }}>{t("painel.stockBaixo")}</h4>
              </div>
              <p style={{ fontSize: 12, opacity: 0.85, margin: "6px 0 12px" }}>
                {t("painel.stockBaixoDesc")}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {alertas.map((a) => (
                  <button
                    key={a.ingrediente.id}
                    type="button"
                    onClick={() => abrirIngrediente(a.ingrediente.id)}
                    className="dashboard-stock-row"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 999,
                      background: "var(--color-bg)",
                      border: 0,
                      cursor: "pointer",
                      color: "var(--color-text)",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{a.ingrediente.nome}</span>
                    <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                      {Math.round(a.stock)} {a.ingrediente.unidade} · {t("painel.falta")}{" "}
                      {Math.round(a.falta)} {a.ingrediente.unidade}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section
            style={{
              background: "var(--color-surface)",
              padding: 22,
              borderRadius: 32,
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <h4 style={{ fontSize: 20 }}>{t("painel.receitasRentaveis")}</h4>
            <AvisoCusto completo />
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
              {topReceitas.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
                  {t("painel.definePrecoVenda")}
                </p>
              ) : (
                topReceitas.map(({ receita, margem }) => (
                  <div key={receita.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{receita.nome}</span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color:
                            margem < 0 ? "var(--color-accent-700)" : "var(--color-accent-2-700)",
                        }}
                      >
                        {Math.round(margem)}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: 7,
                        borderRadius: 999,
                        background: "var(--color-neutral-200)",
                        marginTop: 6,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.max(0, Math.min(100, margem))}%`,
                          background: "var(--color-accent)",
                          borderRadius: 999,
                        }}
                      />
                    </div>
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
