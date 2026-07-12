import { useEffect, useState } from "react";
import { z } from "zod";
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
import { toast } from "sonner";
import { db, type Ingrediente, type UnidadeMedida } from "@/lib/db";

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

type FormValues = {
  nome: string;
  unidade: UnidadeMedida;
  quantidadeEmbalagem: string;
  precoEmbalagem: string;
};

const empty: FormValues = {
  nome: "",
  unidade: "g",
  quantidadeEmbalagem: "",
  precoEmbalagem: "",
};

export function IngredienteFormDialog({
  open,
  onOpenChange,
  ingrediente,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingrediente?: Ingrediente | null;
}) {
  const isEdit = !!ingrediente;
  const [values, setValues] = useState<FormValues>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setErrors({});
      setValues(
        ingrediente
          ? {
              nome: ingrediente.nome,
              unidade: ingrediente.unidade,
              quantidadeEmbalagem: String(ingrediente.quantidadeEmbalagem),
              precoEmbalagem: String(ingrediente.precoEmbalagem),
            }
          : empty,
      );
    }
  }, [open, ingrediente]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar ingrediente" : "Novo ingrediente"}
          </DialogTitle>
          <DialogDescription>
            Regista a compra: quanto trouxeste e quanto pagaste.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="quantidade">Quantidade comprada</Label>
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
            <Label htmlFor="preco">Preço pago (€)</Label>
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
              onClick={() => onOpenChange(false)}
              className="h-12 flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} className="h-12 flex-1">
              {submitting ? "A gravar…" : isEdit ? "Guardar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
