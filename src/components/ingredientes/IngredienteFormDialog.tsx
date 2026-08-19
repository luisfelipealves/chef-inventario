import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { z } from "zod";
import { BarcodeScannerDialog } from "@/components/ingredientes/BarcodeScannerDialog";
import { fetchProdutoOFF } from "@/lib/open-food-facts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { db, type Ingrediente, type UnidadeMedida } from "@/lib/db";
import { custoPorUnidade, formatEuro, unidadeMinimaLabel } from "@/lib/format";

const schema = z.object({
  nome: z.string().trim().min(1, "Indica o nome").max(80, "Máximo 80 caracteres"),
  unidade: z.enum(["g", "kg", "ml", "l", "un"]),
  quantidadeEmbalagem: z.coerce
    .number({ invalid_type_error: "Número inválido" })
    .positive("Deve ser maior que 0"),
  precoEmbalagem: z.coerce
    .number({ invalid_type_error: "Número inválido" })
    .nonnegative("Não pode ser negativo"),
});

const addSchema = z.object({
  quantidade: z.coerce
    .number({ invalid_type_error: "Número inválido" })
    .positive("Deve ser maior que 0"),
  preco: z.coerce
    .number({ invalid_type_error: "Número inválido" })
    .nonnegative("Não pode ser negativo"),
});

type FormValues = {
  nome: string;
  unidade: UnidadeMedida;
  quantidadeEmbalagem: string;
  precoEmbalagem: string;
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
  const isEdit = !!ingrediente;
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

  async function handleBarcode(code: string) {
    if (lastScannedRef.current === code) return;
    lastScannedRef.current = code;
    setScannerOpen(false);
    setScanning(true);
    setCodigoBarras(code);
    try {
      const produto = await fetchProdutoOFF(code);
      if (!produto || !produto.nome) {
        toast.error("Produto não encontrado no Open Food Facts");
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
      toast.error("Erro ao consultar Open Food Facts");
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
            }
          : prefill
            ? {
                nome: prefill.nome ?? "",
                unidade: prefill.unidade ?? "g",
                quantidadeEmbalagem:
                  prefill.quantidadeEmbalagem != null
                    ? String(prefill.quantidadeEmbalagem)
                    : "",
                precoEmbalagem: "",
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
    setSubmitting(true);
    try {
      if (isEdit && ingrediente) {
        await db.ingredientes.update(ingrediente.id, {
          nome: parsed.data.nome,
          unidade: parsed.data.unidade,
          quantidadeEmbalagem: parsed.data.quantidadeEmbalagem,
          precoEmbalagem: parsed.data.precoEmbalagem,
        });
        toast.success("Ingrediente atualizado");
      } else {
        await db.ingredientes.add({
          nome: parsed.data.nome,
          unidade: parsed.data.unidade,
          quantidadeEmbalagem: parsed.data.quantidadeEmbalagem,
          precoEmbalagem: parsed.data.precoEmbalagem,
          createdAt: new Date(),
        } as Ingrediente);
        toast.success("Ingrediente adicionado");
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gravar");
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
      const novaQuantidade =
        ingrediente.quantidadeEmbalagem + parsed.data.quantidade;
      // Custo unitário refere-se a esta compra (preço / quantidade comprada),
      // não à média ponderada com o stock antigo. Guardamos o preço equivalente
      // para o stock total mantendo esse custo unitário.
      const custoUnitarioCompra =
        parsed.data.quantidade > 0
          ? parsed.data.preco / parsed.data.quantidade
          : 0;
      const novoPreco = custoUnitarioCompra * novaQuantidade;
      await db.ingredientes.update(ingrediente.id, {
        quantidadeEmbalagem: novaQuantidade,
        precoEmbalagem: novoPreco,
      });
      toast.success("Compra adicionada ao stock");
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gravar");
    } finally {
      setSubmitting(false);
    }
  }

  // Preview: custo unitário baseado apenas na nova compra
  const addQtd = Number(addValues.quantidade) || 0;
  const addPreco = Number(addValues.preco) || 0;
  const previewQtd = (ingrediente?.quantidadeEmbalagem ?? 0) + addQtd;
  const previewUnitario = addQtd > 0 ? addPreco / addQtd : 0;
  const previewPreco = previewUnitario * previewQtd;


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar ingrediente" : "Novo ingrediente"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Corrige os dados ou adiciona uma nova compra ao stock."
              : "Regista a compra: quanto trouxeste e quanto pagaste."}
          </DialogDescription>
        </DialogHeader>

        {isEdit ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "dados" | "compra")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dados">Editar dados</TabsTrigger>
              <TabsTrigger value="compra">Adicionar compra</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="mt-4">
              <EditFields
                values={values}
                setValues={setValues}
                errors={errors}
                onSubmit={handleSubmit}
                submitting={submitting}
                onCancel={() => onOpenChange(false)}
                submitLabel="Guardar"
              />
            </TabsContent>

            <TabsContent value="compra" className="mt-4">
              <form onSubmit={handleAddPurchase} className="space-y-4">
                <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Stock atual:{" "}
                  <span className="font-medium text-foreground">
                    {ingrediente?.quantidadeEmbalagem} {ingrediente?.unidade}
                  </span>{" "}
                  ·{" "}
                  <span className="font-medium text-foreground">
                    {formatEuro(ingrediente?.precoEmbalagem ?? 0, { compact: true })}
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-quantidade">
                    Quantidade comprada ({ingrediente?.unidade})
                  </Label>
                  <Input
                    id="add-quantidade"
                    inputMode="decimal"
                    placeholder="500"
                    value={addValues.quantidade}
                    onChange={(e) =>
                      setAddValues((v) => ({ ...v, quantidade: e.target.value }))
                    }
                    className="h-12 text-base"
                    autoFocus
                  />
                  {addErrors.quantidade && (
                    <p className="text-xs text-destructive">{addErrors.quantidade}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-preco">Preço pago (€)</Label>
                  <Input
                    id="add-preco"
                    inputMode="decimal"
                    placeholder="2.50"
                    value={addValues.preco}
                    onChange={(e) =>
                      setAddValues((v) => ({ ...v, preco: e.target.value }))
                    }
                    className="h-12 text-base"
                  />
                  {addErrors.preco && (
                    <p className="text-xs text-destructive">{addErrors.preco}</p>
                  )}
                </div>

                {addQtd > 0 && (
                  <div className="space-y-1 rounded-lg border border-border bg-card px-3 py-2 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Novo stock</span>
                      <span className="font-medium text-foreground">
                        {previewQtd} {ingrediente?.unidade} ·{" "}
                        {formatEuro(previewPreco, { compact: true })}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>
                        Novo custo por{" "}
                        {ingrediente
                          ? unidadeMinimaLabel(ingrediente.unidade)
                          : "unidade"}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatEuro(previewUnitario)}
                      </span>
                    </div>
                  </div>
                )}

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
                    {submitting ? "A gravar…" : "Adicionar ao stock"}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setScannerOpen(true)}
              disabled={scanning}
              className="h-12 w-full"
            >
              <ScanLine className="mr-2 h-5 w-5" />
              {scanning ? "A consultar produto…" : "Ler código de barras"}
            </Button>
            <EditFields
              values={values}
              setValues={setValues}
              errors={errors}
              onSubmit={handleSubmit}
              submitting={submitting}
              onCancel={() => onOpenChange(false)}
              submitLabel="Adicionar"
            />
          </div>
        )}
      </DialogContent>
      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleBarcode}
      />
    </Dialog>
  );
}

function EditFields({
  values,
  setValues,
  errors,
  onSubmit,
  submitting,
  onCancel,
  submitLabel,
}: {
  values: FormValues;
  setValues: React.Dispatch<React.SetStateAction<FormValues>>;
  errors: Partial<Record<keyof FormValues, string>>;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome do ingrediente</Label>
        <Input
          id="nome"
          placeholder="Ex: Farinha T65"
          value={values.nome}
          onChange={(e) => setValues((v) => ({ ...v, nome: e.target.value }))}
          maxLength={80}
          autoFocus
          className="h-12 text-base"
        />
        {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="quantidade">Quantidade total</Label>
          <Input
            id="quantidade"
            inputMode="decimal"
            placeholder="1000"
            value={values.quantidadeEmbalagem}
            onChange={(e) =>
              setValues((v) => ({ ...v, quantidadeEmbalagem: e.target.value }))
            }
            className="h-12 text-base"
          />
          {errors.quantidadeEmbalagem && (
            <p className="text-xs text-destructive">{errors.quantidadeEmbalagem}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="unidade">Unidade</Label>
          <Select
            value={values.unidade}
            onValueChange={(u) =>
              setValues((v) => ({ ...v, unidade: u as UnidadeMedida }))
            }
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
        <Label htmlFor="preco">Preço total pago (€)</Label>
        <Input
          id="preco"
          inputMode="decimal"
          placeholder="5.00"
          value={values.precoEmbalagem}
          onChange={(e) =>
            setValues((v) => ({ ...v, precoEmbalagem: e.target.value }))
          }
          className="h-12 text-base"
        />
        {errors.precoEmbalagem && (
          <p className="text-xs text-destructive">{errors.precoEmbalagem}</p>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-12 flex-1"
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting} className="h-12 flex-1">
          {submitting ? "A gravar…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
