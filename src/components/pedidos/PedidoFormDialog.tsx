import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { guardarPedido } from "@/lib/producao";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  type Cliente,
  type EstadoPedido,
  type Ingrediente,
  type ItemPedido,
  type Pedido,
  type Receita,
} from "@/lib/db";
import { formatEuro } from "@/lib/format";
import { custoDoseReceita, totaisPedido } from "@/lib/pedido-calc";

const ESTADOS: EstadoPedido[] = ["pendente", "confirmado", "entregue", "cancelado"];

type LinhaDraft = {
  key: string;
  receitaId: number | null;
  quantidade: string;
  precoUnitario: string;
};

function newLinha(): LinhaDraft {
  return {
    key: crypto.randomUUID?.() ?? String(Math.random()),
    receitaId: null,
    quantidade: "1",
    precoUnitario: "",
  };
}

export function PedidoFormDialog({
  open,
  onOpenChange,
  pedido,
  clientes,
  receitas,
  ingredientes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido?: Pedido | null;
  clientes: Cliente[];
  receitas: Receita[];
  ingredientes: Ingrediente[];
}) {
  const { t } = useTranslation();
  const isEdit = !!pedido;
  const schema = useMemo(
    () =>
      z.object({
        clienteId: z.string().min(1, t("pedidoForm.errCliente")),
        dataEntrega: z.string().min(1, t("pedidoForm.errData")),
      }),
    [t],
  );
  const [clienteId, setClienteId] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [estado, setEstado] = useState<EstadoPedido>("pendente");
  const [notas, setNotas] = useState("");
  const [linhas, setLinhas] = useState<LinhaDraft[]>([newLinha()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (pedido) {
      setClienteId(String(pedido.clienteId));
      setDataEntrega(pedido.dataEntrega);
      setEstado(pedido.estado);
      setNotas(pedido.notas ?? "");
      setLinhas(
        pedido.itens.length > 0
          ? pedido.itens.map((i) => ({
              key: crypto.randomUUID?.() ?? String(Math.random()),
              receitaId: i.receitaId,
              quantidade: String(i.quantidade),
              precoUnitario: String(i.precoUnitario),
            }))
          : [newLinha()],
      );
    } else {
      setClienteId("");
      setDataEntrega(new Date().toISOString().slice(0, 10));
      setEstado("pendente");
      setNotas("");
      setLinhas([newLinha()]);
    }
  }, [open, pedido]);

  const receitaMap = useMemo(() => new Map(receitas.map((r) => [r.id, r])), [receitas]);
  const ingMap = useMemo(() => new Map(ingredientes.map((i) => [i.id, i])), [ingredientes]);

  const itensValidos: ItemPedido[] = useMemo(
    () =>
      linhas
        .filter((l) => l.receitaId != null && Number(l.quantidade) > 0)
        .map((l) => ({
          receitaId: l.receitaId as number,
          quantidade: Number(l.quantidade),
          precoUnitario: Number(l.precoUnitario) || 0,
        })),
    [linhas],
  );

  const totais = totaisPedido(itensValidos, receitaMap, ingMap);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ clienteId, dataEntrega });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!errs[key]) errs[key] = issue.message;
      }
      setErrors(errs);
      return;
    }
    if (
      linhas.some(
        (l) =>
          l.receitaId == null ||
          !Number.isFinite(Number(l.quantidade)) ||
          Number(l.quantidade) <= 0 ||
          !Number.isFinite(Number(l.precoUnitario)) ||
          Number(l.precoUnitario) < 0,
      )
    ) {
      toast.error(
        "Reveja todas as linhas: selecione a receita, informe quantidade positiva e preço não negativo.",
      );
      return;
    }
    if (itensValidos.length === 0) {
      toast.error(t("pedidoForm.adicionaReceita"));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        clienteId: Number(clienteId),
        dataEntrega,
        estado,
        notas: notas.trim(),
        itens: itensValidos,
      };
      await guardarPedido(payload, pedido?.id);
      toast.success(t(isEdit ? "pedidoForm.pedidoAtualizado" : "pedidoForm.pedidoCriado"));
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : t("comum.erroGravar"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-4 overflow-hidden border-0 bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)] sm:max-w-[480px] sm:rounded-l-[32px]"
      >
        <SheetHeader>
          <span className="card-kicker">{t("pedidos.kicker")}</span>
          <SheetTitle className="font-heading text-2xl font-normal">
            {isEdit ? t("pedidoForm.editarTitulo") : t("pedidoForm.novoTitulo")}
          </SheetTitle>
          <SheetDescription>
            {pedido?.estado === "entregue"
              ? "Pedido entregue: reabra pelo seletor de estado antes de editar. A reversão repõe as doses; entregas antigas sem registro de baixa não permitem reversão automática."
              : t("pedidoForm.desc")}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1"
        >
          <div className="space-y-2">
            <Label htmlFor="cliente">{t("pedidoForm.cliente")}</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger id="cliente" className="h-12 text-base">
                <SelectValue placeholder={t("pedidoForm.escolherCliente")} />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clientes.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("pedidoForm.semClientes")}</p>
            )}
            {errors.clienteId && <p className="text-xs text-destructive">{errors.clienteId}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 min-w-0">
              <Label htmlFor="dataEntrega">{t("pedidoForm.entrega")}</Label>
              <Input
                id="dataEntrega"
                type="date"
                value={dataEntrega}
                onChange={(e) => setDataEntrega(e.target.value)}
                className="h-12 text-base"
              />
              {errors.dataEntrega && (
                <p className="text-xs text-destructive">{errors.dataEntrega}</p>
              )}
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="estado">{t("pedidoForm.estado")}</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as EstadoPedido)}>
                <SelectTrigger id="estado" className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {t(`estado.${e}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("pedidoForm.receitas")}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLinhas((ls) => [...ls, newLinha()])}
                className="h-9"
              >
                <Plus className="mr-1 h-4 w-4" />
                {t("pedidoForm.adicionar")}
              </Button>
            </div>

            {receitas.length === 0 ? (
              <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                {t("pedidoForm.semReceitas")}
              </p>
            ) : (
              <ul className="space-y-2">
                {linhas.map((linha, idx) => {
                  const receita = linha.receitaId ? receitaMap.get(linha.receitaId) : undefined;
                  const custoUnit = custoDoseReceita(receita, ingMap);
                  const qtd = Number(linha.quantidade) || 0;
                  const subtotal = (Number(linha.precoUnitario) || 0) * qtd;
                  return (
                    <li key={linha.key} className="rounded-lg border border-border bg-card p-3">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                        <Select
                          value={linha.receitaId != null ? String(linha.receitaId) : ""}
                          onValueChange={(v) =>
                            setLinhas((ls) =>
                              ls.map((l, i) =>
                                i === idx
                                  ? {
                                      ...l,
                                      receitaId: Number(v),
                                      precoUnitario: (() => {
                                        if (l.precoUnitario !== "") return l.precoUnitario;
                                        const r = receitaMap.get(Number(v));
                                        if (r?.precoVenda != null && r.rendimento > 0) {
                                          return (r.precoVenda / r.rendimento).toFixed(2);
                                        }
                                        return (custoDoseReceita(r, ingMap) * 3).toFixed(2);
                                      })(),
                                    }
                                  : l,
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="h-11 text-base">
                            <SelectValue placeholder={t("pedidoForm.escolherReceita")} />
                          </SelectTrigger>
                          <SelectContent>
                            {receitas.map((r) => (
                              <SelectItem key={r.id} value={String(r.id)}>
                                {r.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 text-destructive hover:text-destructive"
                          onClick={() =>
                            setLinhas((ls) =>
                              ls.length === 1 ? [newLinha()] : ls.filter((_, i) => i !== idx),
                            )
                          }
                          aria-label={t("pedidoForm.removerLinha")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            {t("pedidoForm.quantidade")}
                          </Label>
                          <Input
                            inputMode="decimal"
                            placeholder="1"
                            value={linha.quantidade}
                            onChange={(e) =>
                              setLinhas((ls) =>
                                ls.map((l, i) =>
                                  i === idx ? { ...l, quantidade: e.target.value } : l,
                                ),
                              )
                            }
                            className="h-11 text-base"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            {t("pedidoForm.precoUnidade")}
                          </Label>
                          <Input
                            inputMode="decimal"
                            placeholder="0,00"
                            value={linha.precoUnitario}
                            onChange={(e) =>
                              setLinhas((ls) =>
                                ls.map((l, i) =>
                                  i === idx ? { ...l, precoUnitario: e.target.value } : l,
                                ),
                              )
                            }
                            className="h-11 text-base"
                          />
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {t("pedidoForm.custoUn", { v: formatEuro(custoUnit) })}
                        </span>
                        <span className="font-medium tabular-nums text-foreground">
                          {formatEuro(subtotal, { compact: true })}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">{t("pedidos.notas")}</Label>
            <Textarea
              id="notas"
              placeholder={t("pedidoForm.notasPlaceholder")}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              maxLength={300}
              className="text-base"
            />
          </div>

          <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("pedidoForm.custoProducao")}</span>
              <span className="font-medium tabular-nums">
                {formatEuro(totais.custo, { compact: true })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("pedidoForm.lucroEstimado")}</span>
              <span className="font-medium tabular-nums">
                {formatEuro(totais.lucro, { compact: true })} ({totais.margem.toFixed(0)}%)
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 text-base">
              <span className="font-medium">{t("pedidoForm.valorFinal")}</span>
              <span className="font-bold tabular-nums">
                {formatEuro(totais.venda, { compact: true })}
              </span>
            </div>
          </div>

          <SheetFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-11 flex-1 rounded-full"
            >
              {t("comum.cancelar")}
            </Button>
            <Button type="submit" disabled={submitting} className="h-11 flex-1 rounded-full">
              {submitting
                ? t("comum.aGravar")
                : isEdit
                  ? t("comum.guardar")
                  : t("pedidoForm.criarPedido")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
