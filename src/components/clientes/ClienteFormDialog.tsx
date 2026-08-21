import { useEffect, useState } from "react";
import { z } from "zod";
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
import { toast } from "sonner";
import { db, type Cliente } from "@/lib/db";

const schema = z.object({
  nome: z.string().trim().min(1, "Indica o nome").max(80, "Máximo 80 caracteres"),
  telefone: z
    .string()
    .trim()
    .max(20, "Máximo 20 caracteres")
    .refine((v) => v === "" || /^[+0-9 ()-]{6,20}$/.test(v), "Telefone inválido"),
  endereco: z.string().trim().max(160, "Máximo 160 caracteres"),
  nif: z
    .string()
    .trim()
    .max(15, "Máximo 15 caracteres")
    .refine((v) => v === "" || /^[0-9]{9,15}$/.test(v), "NIF inválido"),
});

type FormValues = z.infer<typeof schema>;

const empty: FormValues = { nome: "", telefone: "", endereco: "", nif: "" };

export function ClienteFormDialog({
  open,
  onOpenChange,
  cliente,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: Cliente | null;
}) {
  const isEdit = !!cliente;
  const [values, setValues] = useState<FormValues>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setValues(
      cliente
        ? {
            nome: cliente.nome,
            telefone: cliente.telefone ?? "",
            endereco: cliente.endereco ?? "",
            nif: cliente.nif ?? "",
          }
        : empty,
    );
  }, [open, cliente]);

  function set<K extends keyof FormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormValues;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && cliente) {
        await db.clientes.update(cliente.id, parsed.data);
        toast.success("Cliente atualizado");
      } else {
        await db.clientes.add({ ...parsed.data, createdAt: new Date() } as Cliente);
        toast.success("Cliente adicionado");
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao guardar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-4 overflow-y-auto border-0 bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)] sm:max-w-[480px] sm:rounded-l-[32px]"
      >
        <SheetHeader>
          <span className="card-kicker">Cliente</span>
          <SheetTitle className="font-heading text-2xl font-normal">
            {isEdit ? "Editar cliente" : "Novo cliente"}
          </SheetTitle>
          <SheetDescription>Guarda os contactos dos teus clientes no dispositivo.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cliente-nome">Nome</Label>
            <Input
              id="cliente-nome"
              value={values.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Ex.: Maria Silva"
              className="h-12 text-base"
              autoComplete="name"
            />
            {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cliente-telefone">Telefone</Label>
            <Input
              id="cliente-telefone"
              inputMode="tel"
              value={values.telefone}
              onChange={(e) => set("telefone", e.target.value)}
              placeholder="Ex.: 912 345 678"
              className="h-12 text-base"
              autoComplete="tel"
            />
            {errors.telefone && <p className="text-xs text-destructive">{errors.telefone}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cliente-endereco">Endereço</Label>
            <Input
              id="cliente-endereco"
              value={values.endereco}
              onChange={(e) => set("endereco", e.target.value)}
              placeholder="Rua, nº, código postal, localidade"
              className="h-12 text-base"
              autoComplete="street-address"
            />
            {errors.endereco && <p className="text-xs text-destructive">{errors.endereco}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cliente-nif">NIF</Label>
            <Input
              id="cliente-nif"
              inputMode="numeric"
              value={values.nif}
              onChange={(e) => set("nif", e.target.value)}
              placeholder="Ex.: 123456789"
              className="h-12 text-base"
            />
            {errors.nif && <p className="text-xs text-destructive">{errors.nif}</p>}
          </div>

          <SheetFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-full"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="h-11 flex-1 rounded-full" disabled={submitting}>
              {isEdit ? "Guardar" : "Adicionar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
