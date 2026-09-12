import { AvisoCusto, ResumoIndicadores } from "@/components/custos/ResumoIndicadores";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  type Ingrediente,
  type IngredienteReceita,
  type Receita,
  type UnidadeMedida,
} from "@/lib/db";
import { formatEuro } from "@/lib/format";
import { resumoReceita, custoLinha } from "@/lib/receita-custo";
import { gerarId } from "@/lib/id";

type FormValues = {
  nome: string;
  rendimento: string;
  unidadeRendimento: UnidadeMedida;
  precoVenda: string;
};

type LinhaDraft = {
  key: string;
  ingredienteId: number | null;
  quantidade: string;
};

const empty: FormValues = { nome: "", rendimento: "", unidadeRendimento: "un", precoVenda: "" };

function newLinha(): LinhaDraft {
  return {
    key: gerarId(),
    ingredienteId: null,
    quantidade: "",
  };
}

export function ReceitaFormDialog({
  open,
  onOpenChange,
  receita,
  ingredientes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receita?: Receita | null;
  ingredientes: Ingrediente[];
}) {
  const { t } = useTranslation();
  const isEdit = !!receita;
  const schema = useMemo(
    () =>
      z.object({
        nome: z.string().trim().min(1, t("receitaForm.errNome")).max(80),
        rendimento: z.coerce
          .number({ invalid_type_error: t("receitaForm.errNumero") })
          .finite(t("receitaForm.errNumero"))
          .positive(t("receitaForm.errPositivo")),
        unidadeRendimento: z.enum(["g", "kg", "ml", "l", "un"]),
        precoVenda: z.preprocess(
          (v) => (v === "" ? undefined : v),
          z.coerce
            .number({ invalid_type_error: t("receitaForm.errNumero") })
            .finite(t("receitaForm.errNumero"))
            .nonnegative(t("receitaForm.errNaoNegativo"))
            .optional(),
        ),
      }),
    [t],
  );
  const [values, setValues] = useState<FormValues>(empty);
  const [linhas, setLinhas] = useState<LinhaDraft[]>([newLinha()]);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (receita) {
      setValues({
        nome: receita.nome,
        rendimento: String(receita.rendimento),
        unidadeRendimento: receita.unidadeRendimento,
        precoVenda: receita.precoVenda != null ? String(receita.precoVenda) : "",
      });
      setLinhas(
        receita.ingredientes.length > 0
          ? receita.ingredientes.map((l) => ({
              key: gerarId(),
              ingredienteId: l.ingredienteId,
              quantidade: String(l.quantidade),
            }))
          : [newLinha()],
      );
    } else {
      setValues(empty);
      setLinhas([newLinha()]);
    }
  }, [open, receita]);

  const ingMap = useMemo(() => new Map(ingredientes.map((i) => [i.id, i])), [ingredientes]);

  const linhasValidas: IngredienteReceita[] = useMemo(
    () =>
      linhas
        .filter((l) => l.ingredienteId != null && Number(l.quantidade) > 0)
        .map((l) => ({
          ingredienteId: l.ingredienteId as number,
          quantidade: Number(l.quantidade),
        })),
    [linhas],
  );

  const resumo = resumoReceita(
    {
      ingredientes: linhas.map((l) => ({
        ingredienteId: l.ingredienteId ?? -1,
        quantidade: Number(l.quantidade),
      })),
      rendimento: Number(values.rendimento),
      precoVenda: values.precoVenda.trim() === "" ? undefined : Number(values.precoVenda),
    },
    ingMap,
  );
  const { custoTotal, custoDose } = resumo;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const errs: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormValues;
        if (!errs[key]) errs[key] = issue.message;
      }
      setErrors(errs);
      return;
    }
    if (
      linhasValidas.length === 0 ||
      linhasValidas.length !== linhas.length ||
      linhas.some((l) => !Number.isFinite(Number(l.quantidade)))
    ) {
      toast.error(t("receitaForm.adicionaIngrediente"));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        nome: parsed.data.nome,
        rendimento: parsed.data.rendimento,
        unidadeRendimento: parsed.data.unidadeRendimento,
        ingredientes: linhasValidas,
        precoVenda: parsed.data.precoVenda,
      };
      if (isEdit && receita) {
        await db.receitas.update(receita.id, payload);
        toast.success(t("receitaForm.receitaAtualizada"));
      } else {
        await db.receitas.add({
          ...payload,
          createdAt: new Date(),
        } as Receita);
        toast.success(t("receitaForm.receitaCriada"));
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(t("comum.erroGravar"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="receita-form-sheet flex w-full flex-col gap-4 overflow-hidden border-0 bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)] sm:max-w-[480px] sm:rounded-l-[32px]"
      >
        <SheetHeader>
          <span className="card-kicker">{t("receitaForm.kicker")}</span>
          <SheetTitle className="font-heading text-2xl font-normal">
            {isEdit ? t("receitaForm.editarTitulo") : t("receitaForm.novaTitulo")}
          </SheetTitle>
          <SheetDescription>{t("receitaForm.desc")}</SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1"
        >
          <div className="space-y-2">
            <Label htmlFor="nome">{t("receitaForm.nome")}</Label>
            <Input
              id="nome"
              placeholder={t("receitaForm.nomePlaceholder")}
              value={values.nome}
              onChange={(e) => setValues((v) => ({ ...v, nome: e.target.value }))}
              maxLength={80}
              autoFocus
              className="h-12 text-base"
            />
            {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
          </div>

          <div className="receita-form-yield-grid grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
            <div className="space-y-2 min-w-0">
              <Label htmlFor="rendimento">{t("receitaForm.rendimento")}</Label>
              <Input
                id="rendimento"
                inputMode="decimal"
                placeholder="20"
                value={values.rendimento}
                onChange={(e) => setValues((v) => ({ ...v, rendimento: e.target.value }))}
                className="h-12 text-base"
              />
              {errors.rendimento && <p className="text-xs text-destructive">{errors.rendimento}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="unidadeRendimento">{t("receitaForm.unidade")}</Label>
              <Select
                value={values.unidadeRendimento}
                onValueChange={(u) =>
                  setValues((v) => ({ ...v, unidadeRendimento: u as UnidadeMedida }))
                }
              >
                <SelectTrigger id="unidadeRendimento" className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="un">{t("receitaForm.unDoses")}</SelectItem>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="l">l</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("receitaForm.ingredientes")}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLinhas((ls) => [...ls, newLinha()])}
                className="h-9"
              >
                <Plus className="mr-1 h-4 w-4" />
                {t("receitaForm.adicionar")}
              </Button>
            </div>

            {ingredientes.length === 0 ? (
              <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                Ainda não tens ingredientes no stock. Adiciona-os primeiro na página de
                Ingredientes.
              </p>
            ) : (
              <ul className="space-y-2">
                {linhas.map((linha, idx) => {
                  const ing = linha.ingredienteId ? ingMap.get(linha.ingredienteId) : undefined;
                  return (
                    <li key={linha.key} className="rounded-lg border border-border bg-card p-3">
                      <div className="receita-form-ingredient-grid grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                        <Select
                          value={linha.ingredienteId != null ? String(linha.ingredienteId) : ""}
                          onValueChange={(v) =>
                            setLinhas((ls) =>
                              ls.map((l, i) =>
                                i === idx ? { ...l, ingredienteId: Number(v) } : l,
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="h-11 text-base">
                            <SelectValue placeholder={t("receitaForm.escolherIngrediente")} />
                          </SelectTrigger>
                          <SelectContent>
                            {ingredientes.map((i) => (
                              <SelectItem key={i.id} value={String(i.id)}>
                                {i.nome} ({i.unidade})
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
                          aria-label={t("receitaForm.removerLinha")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="receita-form-quantity-grid mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                        <div className="relative">
                          <Input
                            inputMode="decimal"
                            placeholder={t("receitaForm.quantidadePlaceholder")}
                            value={linha.quantidade}
                            onChange={(e) =>
                              setLinhas((ls) =>
                                ls.map((l, i) =>
                                  i === idx ? { ...l, quantidade: e.target.value } : l,
                                ),
                              )
                            }
                            className="h-11 pr-12 text-base"
                          />
                          {ing && (
                            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                              {ing.unidade}
                            </span>
                          )}
                        </div>
                        <span className="min-w-16 text-right text-sm font-medium tabular-nums text-foreground">
                          {formatEuro(
                            custoLinha(
                              {
                                ingredienteId: linha.ingredienteId ?? -1,
                                quantidade: Number(linha.quantidade),
                              },
                              ing,
                            ),
                            { compact: true },
                          )}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="precoVenda">{t("receitaForm.precoVenda")}</Label>
            <Input
              id="precoVenda"
              inputMode="decimal"
              placeholder={t("receitaForm.precoVendaPlaceholder")}
              value={values.precoVenda}
              onChange={(e) => setValues((v) => ({ ...v, precoVenda: e.target.value }))}
              className="h-12 text-base"
            />
            {errors.precoVenda && <p className="text-xs text-destructive">{errors.precoVenda}</p>}
          </div>

          <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("receitaForm.custoTotal")}</span>
              <span className="font-semibold tabular-nums">
                {formatEuro(custoTotal, { compact: true })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("receitaForm.custoPor", {
                  unidade:
                    values.unidadeRendimento === "un"
                      ? t("receitaForm.dose")
                      : values.unidadeRendimento,
                })}
              </span>
              <span className="font-semibold tabular-nums">{formatEuro(custoDose)}</span>
            </div>
            <div>
              {t("custos.precoUnitario", { unidade: values.unidadeRendimento })}:{" "}
              <strong>{formatEuro(resumo.precoUnitario)}</strong>
            </div>
            <ResumoIndicadores
              resultado={resumo.resultado}
              margem={resumo.margem}
              acrescimo={resumo.acrescimo}
            />
            <AvisoCusto completo={resumo.completo} />
          </div>

          <SheetFooter className="receita-form-footer gap-2 sm:gap-2">
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
                  : t("receitaForm.criarReceita")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
