import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  db,
  type Cliente,
  type EstadoPedido,
  type Ingrediente,
  type ItemPedido,
  type Pedido,
  type Receita,
} from "@/lib/db";
import { formatEuro } from "@/lib/format";
import { custoDoseReceita, estadoLabel, totaisPedido } from "@/lib/pedido-calc";

const schema = z.object({
  clienteId: z.string().min(1, "Escolhe o cliente"),
  dataEntrega: z.string().min(1, "Indica a data de entrega"),
});

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
  const isEdit = !!pedido;
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

  const receitaMap = useMemo(
    () => new Map(receitas.map((r) => [r.id, r])),
    [receitas],
  );
  const ingMap = useMemo(
    () => new Map(ingredientes.map((i) => [i.id, i])),
    [ingredientes],
  );

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
    if (itensValidos.length === 0) {
      toast.error("Adiciona pelo menos uma receita");
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
      if (isEdit && pedido) {
        await db.pedidos.update(pedido.id, payload);
        toast.success("Pedido atualizado");
      } else {
        await db.pedidos.add({ ...payload, createdAt: new Date() } as Pedido);
        toast.success("Pedido criado");
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gravar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar pedido" : "Novo pedido"}</DialogTitle>
          <DialogDescription>
            Junta um cliente às receitas encomendadas e vê o valor final.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1"
        >
          <div className="space-y-2">
            <Label htmlFor="cliente">Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger id="cliente" className="h-12 text-base">
                <SelectValue placeholder="Escolher cliente" />
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
              <p className="text-xs text-muted-foreground">
                Ainda não tens clientes. Regista-os primeiro em Clientes.
              </p>
            )}
            {errors.clienteId && (
              <p className="text-xs text-destructive">{errors.clienteId}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 min-w-0">
              <Label htmlFor="dataEntrega">Entrega</Label>
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
              <Label htmlFor="estado">Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as EstadoPedido)}>
                <SelectTrigger id="estado" className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(estadoLabel) as EstadoPedido[]).map((e) => (
                    <SelectItem key={e} value={e}>
                      {estadoLabel[e]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Receitas</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLinhas((ls) => [...ls, newLinha()])}
                className="h-9"
              >
                <Plus className="mr-1 h-4 w-4" />
                Adicionar
              </Button>
            </div>

            {receitas.length === 0 ? (
              <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                Ainda não tens receitas. Cria fichas técnicas primeiro.
              </p>
            ) : (
              <ul className="space-y-2">
                {linhas.map((linha, idx) => {
                  const receita = linha.receitaId
                    ? receitaMap.get(linha.receitaId)
                    : undefined;
                  const custoUnit = custoDoseReceita(receita, ingMap);
                  const qtd = Number(linha.quantidade) || 0;
                  const subtotal = (Number(linha.precoUnitario) || 0) * qtd;
                  return (
                    <li
                      key={linha.key}
                      className="rounded-lg border border-border bg-card p-3"
                    >
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
                                      precoUnitario:
                                        l.precoUnitario === ""
                                          ? (
                                              custoDoseReceita(
                                                receitaMap.get(Number(v)),
                                                ingMap,
                                              ) * 3
                                            ).toFixed(2)
                                          : l.precoUnitario,
                                    }
                                  : l,
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="h-11 text-base">
                            <SelectValue placeholder="Escolher receita" />
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
                              ls.length === 1
                                ? [newLinha()]
                                : ls.filter((_, i) => i !== idx),
                            )
                          }
                          aria-label="Remover linha"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            Quantidade
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
                            Preço / unidade
                          </Label>
                          <Input
                            inputMode="decimal"
                            placeholder="0,00"
                            value={linha.precoUnitario}
                            onChange={(e) =>
                              setLinhas((ls) =>
                                ls.map((l, i) =>
                                  i === idx
                                    ? { ...l, precoUnitario: e.target.value }
                                    : l,
                                ),
                              )
                            }
                            className="h-11 text-base"
                          />
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Custo {formatEuro(custoUnit)} / un
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
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              placeholder="Ex: sem lactose, entregar às 15h"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              maxLength={300}
              className="text-base"
            />
          </div>

          <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Custo de produção</span>
              <span className="font-medium tabular-nums">
                {formatEuro(totais.custo, { compact: true })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lucro estimado</span>
              <span className="font-medium tabular-nums">
                {formatEuro(totais.lucro, { compact: true })} ({totais.margem.toFixed(0)}%)
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 text-base">
              <span className="font-medium">Valor final</span>
              <span className="font-bold tabular-nums">
                {formatEuro(totais.venda, { compact: true })}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-12 flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} className="h-12 flex-1">
              {submitting ? "A gravar…" : isEdit ? "Guardar" : "Criar pedido"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
