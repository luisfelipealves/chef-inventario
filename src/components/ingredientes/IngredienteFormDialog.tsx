import { registarCompras } from "@/lib/operacional";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScanLine } from "lucide-react";
import { z } from "zod";
import { BarcodeScannerDialog } from "@/components/ingredientes/BarcodeScannerDialog";
import { fetchProdutoOFF } from "@/lib/open-food-facts";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { db, stockDe, type Ingrediente, type UnidadeMedida } from "@/lib/db";
import { custoPorUnidade, formatEuro, unidadeMinimaLabel } from "@/lib/format";

type FormValues = {
  nome: string;
  unidade: UnidadeMedida;
  quantidadeEmbalagem: string;
  precoEmbalagem: string;
  /** Só editável em modo edição; ao criar nasce da quantidade comprada. */
  stock: string;
};

type AddValues = {
  quantidade: string;
  preco: string;
};

const empty: FormValues = {
  nome: "",
  unidade: "g",
  quantidadeEmbalagem: "",
  precoEmbalagem: "",
  stock: "",
};

const emptyAdd: AddValues = { quantidade: "", preco: "" };

export type IngredientePrefill = {
  nome?: string;
  unidade?: UnidadeMedida;
  quantidadeEmbalagem?: number;
  codigoBarras?: string;
};

export function IngredienteFormDialog({
  open,
  onOpenChange,
  ingrediente,
  prefill,
  initialTab = "dados",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingrediente?: Ingrediente | null;
  prefill?: IngredientePrefill | null;
  initialTab?: "dados" | "compra";
}) {
  const { t } = useTranslation();
  const isEdit = !!ingrediente;
  const { schema, addSchema, stockSchema } = useMemo(() => {
    const numero = { invalid_type_error: t("ingredienteForm.errNumero") };
    return {
      schema: z.object({
        nome: z
          .string()
          .trim()
          .min(1, t("ingredienteForm.errNome"))
          .max(80, t("ingredienteForm.errMax")),
        unidade: z.enum(["g", "kg", "ml", "l", "un"]),
        quantidadeEmbalagem: z.coerce.number(numero).positive(t("ingredienteForm.errPositivo")),
        precoEmbalagem: z.coerce.number(numero).nonnegative(t("ingredienteForm.errNaoNegativo")),
      }),
      stockSchema: z.coerce.number(numero).nonnegative(t("ingredienteForm.errNaoNegativo")),
      addSchema: z.object({
        quantidade: z.coerce.number(numero).positive(t("ingredienteForm.errPositivo")),
        preco: z.coerce.number(numero).nonnegative(t("ingredienteForm.errNaoNegativo")),
      }),
    };
  }, [t]);
  const [tab, setTab] = useState<"dados" | "compra">("dados");
  const [values, setValues] = useState<FormValues>(empty);
  const [addValues, setAddValues] = useState<AddValues>(emptyAdd);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [addErrors, setAddErrors] = useState<Partial<Record<keyof AddValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [codigoBarras, setCodigoBarras] = useState<string | undefined>(undefined);
  const lastScannedRef = useRef<string | null>(null);
  const scannerTriggerRef = useRef<HTMLButtonElement>(null);
  const scannerWasOpenRef = useRef(false);

  useEffect(() => {
    if (scannerWasOpenRef.current && !scannerOpen) scannerTriggerRef.current?.focus();
    scannerWasOpenRef.current = scannerOpen;
  }, [scannerOpen]);

  async function handleBarcode(code: string) {
    if (lastScannedRef.current === code) return;
    lastScannedRef.current = code;
    setScannerOpen(false);
    setScanning(true);
    setCodigoBarras(code);
    try {
      const produto = await fetchProdutoOFF(code);
      if (!produto || !produto.nome) {
        toast.error(t("ingredienteForm.offNaoEncontrado"));
        return;
      }
      setValues((v) => ({
        ...v,
        nome: produto.nome ?? v.nome,
        unidade: produto.unidade ?? v.unidade,
        quantidadeEmbalagem:
          produto.quantidade != null ? String(produto.quantidade) : v.quantidadeEmbalagem,
        precoEmbalagem: "",
      }));
      toast.success(`Encontrado: ${produto.nome}`);
      setTimeout(() => {
        const el = document.getElementById("preco") as HTMLInputElement | null;
        el?.focus();
      }, 50);
    } catch (err) {
      console.error(err);
      toast.error(t("ingredienteForm.offErro"));
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    if (open) {
      setErrors({});
      setAddErrors({});
      setAddValues(emptyAdd);
      setTab(initialTab);
      lastScannedRef.current = null;
      setCodigoBarras(ingrediente?.codigoBarras ?? prefill?.codigoBarras);
      setValues(
        ingrediente
          ? {
              nome: ingrediente.nome,
              unidade: ingrediente.unidade,
              quantidadeEmbalagem: String(ingrediente.quantidadeEmbalagem),
              precoEmbalagem: String(ingrediente.precoEmbalagem),
              stock: String(stockDe(ingrediente)),
            }
          : prefill
            ? {
                nome: prefill.nome ?? "",
                unidade: prefill.unidade ?? "g",
                quantidadeEmbalagem:
                  prefill.quantidadeEmbalagem != null ? String(prefill.quantidadeEmbalagem) : "",
                precoEmbalagem: "",
                stock: "",
              }
            : empty,
      );
    }
  }, [open, ingrediente, prefill, initialTab]);

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
    // O stock só é editável em modo edição — ao criar, o que se comprou é o
    // que entra na despensa.
    const parsedStock = isEdit ? stockSchema.safeParse(values.stock) : null;
    if (parsedStock && !parsedStock.success) {
      setErrors({ stock: parsedStock.error.issues[0]?.message });
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && ingrediente) {
        await db.ingredientes.update(ingrediente.id, {
          nome: parsed.data.nome,
          unidade: parsed.data.unidade,
          quantidadeEmbalagem: parsed.data.quantidadeEmbalagem,
          precoEmbalagem: parsed.data.precoEmbalagem,
          stock: parsedStock?.data ?? stockDe(ingrediente),
          ...(codigoBarras ? { codigoBarras } : {}),
        });
        toast.success(t("ingredienteForm.atualizado"));
      } else {
        await db.ingredientes.add({
          nome: parsed.data.nome,
          unidade: parsed.data.unidade,
          quantidadeEmbalagem: parsed.data.quantidadeEmbalagem,
          precoEmbalagem: parsed.data.precoEmbalagem,
          stock: parsed.data.quantidadeEmbalagem,
          ...(codigoBarras ? { codigoBarras } : {}),
          createdAt: new Date(),
        } as Ingrediente);
        toast.success(t("ingredienteForm.adicionado"));
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : t("comum.erroGravar"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddPurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!ingrediente) return;
    const parsed = addSchema.safeParse(addValues);
    if (!parsed.success) {
      const errs: Partial<Record<keyof AddValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof AddValues;
        if (!errs[key]) errs[key] = issue.message;
      }
      setAddErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      await registarCompras([
        {
          ingredienteId: ingrediente.id,
          nome: ingrediente.nome,
          quantidade: parsed.data.quantidade,
          unidade: ingrediente.unidade,
          valor: parsed.data.preco,
          codigoBarras,
        },
      ]);
      toast.success(t("ingredienteForm.compraAdicionada"));
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : t("comum.erroGravar"));
    } finally {
      setSubmitting(false);
    }
  }

  // Preview: custo unitário baseado apenas na nova compra
  const addQtd = Number(addValues.quantidade) || 0;
  const addPreco = Number(addValues.preco) || 0;
  const previewQtd = (ingrediente ? stockDe(ingrediente) : 0) + addQtd;
  const previewUnitario = addQtd > 0 ? addPreco / addQtd : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="ingrediente-form-sheet flex w-full flex-col gap-4 overflow-y-auto border-0 bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)] sm:max-w-[480px] sm:rounded-l-[32px]"
      >
        <SheetHeader>
          <span className="card-kicker">{t("ingredienteForm.kicker")}</span>
          <SheetTitle className="font-heading text-2xl font-normal">
            {isEdit ? t("ingredienteForm.editarTitulo") : t("ingredienteForm.novoTitulo")}
          </SheetTitle>
          <SheetDescription>
            {isEdit ? t("ingredienteForm.descEditar") : t("ingredienteForm.descNovo")}
          </SheetDescription>
        </SheetHeader>

        {isEdit ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "dados" | "compra")}>
            <TabsList className="ingrediente-form-tabs grid w-full grid-cols-2">
              <TabsTrigger value="dados">{t("ingredienteForm.tabDados")}</TabsTrigger>
              <TabsTrigger value="compra">{t("ingredienteForm.tabCompra")}</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="mt-4">
              <EditFields
                values={values}
                setValues={setValues}
                errors={errors}
                comStock
                onSubmit={handleSubmit}
                submitting={submitting}
                onCancel={() => onOpenChange(false)}
                submitLabel={t("comum.guardar")}
              />
            </TabsContent>

            <TabsContent value="compra" className="mt-4">
              <form onSubmit={handleAddPurchase} className="space-y-4">
                <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {t("ingredienteForm.stockAtual")}{" "}
                  <span className="font-medium text-foreground">
                    {ingrediente ? stockDe(ingrediente) : 0} {ingrediente?.unidade}
                  </span>{" "}
                  ·{" "}
                  <span className="font-medium text-foreground">
                    {formatEuro(
                      custoPorUnidade(
                        ingrediente?.precoEmbalagem ?? 0,
                        ingrediente?.quantidadeEmbalagem ?? 0,
                      ),
                    )}{" "}
                    / {ingrediente ? unidadeMinimaLabel(ingrediente.unidade) : ""}
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-quantidade">
                    {t("ingredienteForm.qtdComprada", { unidade: ingrediente?.unidade ?? "" })}
                  </Label>
                  <Input
                    id="add-quantidade"
                    inputMode="decimal"
                    placeholder="500"
                    value={addValues.quantidade}
                    onChange={(e) => setAddValues((v) => ({ ...v, quantidade: e.target.value }))}
                    className="h-12 text-base"
                    autoFocus
                  />
                  {addErrors.quantidade && (
                    <p className="text-xs text-destructive">{addErrors.quantidade}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-preco">{t("ingredienteForm.precoPago")}</Label>
                  <Input
                    id="add-preco"
                    inputMode="decimal"
                    placeholder="2.50"
                    value={addValues.preco}
                    onChange={(e) => setAddValues((v) => ({ ...v, preco: e.target.value }))}
                    className="h-12 text-base"
                  />
                  {addErrors.preco && <p className="text-xs text-destructive">{addErrors.preco}</p>}
                </div>

                {addQtd > 0 && (
                  <div className="space-y-1 rounded-lg border border-border bg-card px-3 py-2 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("ingredienteForm.novoStock")}</span>
                      <span className="font-medium text-foreground">
                        {previewQtd} {ingrediente?.unidade}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>
                        {t("ingredienteForm.novoCustoPor", {
                          unidade: ingrediente
                            ? unidadeMinimaLabel(ingrediente.unidade)
                            : t("ingredienteForm.unidadeFallback"),
                        })}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatEuro(previewUnitario)}
                      </span>
                    </div>
                  </div>
                )}

                <SheetFooter className="ingrediente-form-footer gap-2 sm:gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="h-11 flex-1 rounded-full"
                  >
                    {t("comum.cancelar")}
                  </Button>
                  <Button type="submit" disabled={submitting} className="h-11 flex-1 rounded-full">
                    {submitting ? t("comum.aGravar") : t("ingredienteForm.adicionarStock")}
                  </Button>
                </SheetFooter>
              </form>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-3">
            <Button
              type="button"
              ref={scannerTriggerRef}
              variant="outline"
              onClick={() => setScannerOpen(true)}
              disabled={scanning}
              className="h-12 w-full"
            >
              <ScanLine className="mr-2 h-5 w-5" />
              {scanning ? t("ingredienteForm.aConsultar") : t("ingredienteForm.lerCodigo")}
            </Button>
            <EditFields
              values={values}
              setValues={setValues}
              errors={errors}
              onSubmit={handleSubmit}
              submitting={submitting}
              onCancel={() => onOpenChange(false)}
              submitLabel={t("ingredienteForm.adicionar")}
            />
          </div>
        )}
      </SheetContent>
      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleBarcode}
      />
    </Sheet>
  );
}

function EditFields({
  values,
  setValues,
  errors,
  comStock = false,
  onSubmit,
  submitting,
  onCancel,
  submitLabel,
}: {
  values: FormValues;
  setValues: React.Dispatch<React.SetStateAction<FormValues>>;
  errors: Partial<Record<keyof FormValues, string>>;
  /** Mostra o stock em despensa (só na edição — ao criar vem da compra). */
  comStock?: boolean;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">{t("ingredienteForm.nome")}</Label>
        <Input
          id="nome"
          placeholder={t("ingredienteForm.nomePlaceholder")}
          value={values.nome}
          onChange={(e) => setValues((v) => ({ ...v, nome: e.target.value }))}
          maxLength={80}
          autoFocus
          className="h-12 text-base"
        />
        {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
      </div>

      <div className="ingrediente-form-quantity-grid grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="quantidade">{t("ingredienteForm.quantidadeTotal")}</Label>
          <Input
            id="quantidade"
            inputMode="decimal"
            placeholder="1000"
            value={values.quantidadeEmbalagem}
            onChange={(e) => setValues((v) => ({ ...v, quantidadeEmbalagem: e.target.value }))}
            className="h-12 text-base"
          />
          {errors.quantidadeEmbalagem && (
            <p className="text-xs text-destructive">{errors.quantidadeEmbalagem}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="unidade">{t("ingredienteForm.unidade")}</Label>
          <Select
            value={values.unidade}
            onValueChange={(u) => setValues((v) => ({ ...v, unidade: u as UnidadeMedida }))}
          >
            <SelectTrigger id="unidade" className="h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="g">g</SelectItem>
              <SelectItem value="kg">kg</SelectItem>
              <SelectItem value="ml">ml</SelectItem>
              <SelectItem value="l">l</SelectItem>
              <SelectItem value="un">un</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="preco">{t("ingredienteForm.precoTotalPago")}</Label>
        <Input
          id="preco"
          inputMode="decimal"
          placeholder="5.00"
          value={values.precoEmbalagem}
          onChange={(e) => setValues((v) => ({ ...v, precoEmbalagem: e.target.value }))}
          className="h-12 text-base"
        />
        {errors.precoEmbalagem && (
          <p className="text-xs text-destructive">{errors.precoEmbalagem}</p>
        )}
      </div>

      {comStock && (
        <div className="space-y-2">
          <Label htmlFor="stock">
            {t("ingredientes.stock")} ({values.unidade})
          </Label>
          <Input
            id="stock"
            inputMode="decimal"
            placeholder="1000"
            value={values.stock}
            onChange={(e) => setValues((v) => ({ ...v, stock: e.target.value }))}
            className="h-12 text-base"
          />
          {errors.stock && <p className="text-xs text-destructive">{errors.stock}</p>}
        </div>
      )}

      <SheetFooter className="ingrediente-form-footer gap-2 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-11 flex-1 rounded-full"
        >
          {t("comum.cancelar")}
        </Button>
        <Button type="submit" disabled={submitting} className="h-11 flex-1 rounded-full">
          {submitting ? t("comum.aGravar") : submitLabel}
        </Button>
      </SheetFooter>
    </form>
  );
}
