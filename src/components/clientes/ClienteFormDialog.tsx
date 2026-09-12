import { useEffect, useState, useMemo } from "react";
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
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { db, type Cliente } from "@/lib/db";

function criarSchema(t: (k: string, o?: Record<string, unknown>) => string) {
  return z.object({
    nome: z
      .string()
      .trim()
      .min(1, t("clienteForm.errNome"))
      .max(80, t("clienteForm.errMax", { n: 80 })),
    telefone: z
      .string()
      .trim()
      .max(20, t("clienteForm.errMax", { n: 20 }))
      .refine((v) => v === "" || /^[+0-9 ()-]{6,20}$/.test(v), t("clienteForm.errTelefone")),
    endereco: z
      .string()
      .trim()
      .max(160, t("clienteForm.errMax", { n: 160 })),
    nif: z
      .string()
      .trim()
      .max(15, t("clienteForm.errMax", { n: 15 }))
      .refine((v) => v === "" || /^[0-9]{9,15}$/.test(v), t("clienteForm.errNif")),
  });
}

type FormValues = z.infer<ReturnType<typeof criarSchema>>;

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
  const { t } = useTranslation();
  const schema = useMemo(() => criarSchema(t), [t]);
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
        toast.success(t("clienteForm.atualizado"));
      } else {
        await db.clientes.add({ ...parsed.data, createdAt: new Date() } as Cliente);
        toast.success(t("clienteForm.adicionado"));
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(t("clienteForm.erroGuardar"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="cliente-form-sheet flex w-full flex-col gap-4 overflow-y-auto border-0 bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)] sm:max-w-[480px] sm:rounded-l-[32px]"
      >
        <SheetHeader>
          <span className="card-kicker">{t("clienteForm.kicker")}</span>
          <SheetTitle className="font-heading text-2xl font-normal">
            {isEdit ? t("clienteForm.editarTitulo") : t("clienteForm.novoTitulo")}
          </SheetTitle>
          <SheetDescription>{t("clienteForm.desc")}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cliente-nome">{t("clienteForm.nome")}</Label>
            <Input
              id="cliente-nome"
              value={values.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder={t("clienteForm.nomePlaceholder")}
              className="h-12 text-base"
              autoComplete="name"
              autoFocus
            />
            {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cliente-telefone">{t("clienteForm.telefone")}</Label>
            <Input
              id="cliente-telefone"
              inputMode="tel"
              value={values.telefone}
              onChange={(e) => set("telefone", e.target.value)}
              placeholder={t("clienteForm.telefonePlaceholder")}
              className="h-12 text-base"
              autoComplete="tel"
            />
            {errors.telefone && <p className="text-xs text-destructive">{errors.telefone}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cliente-endereco">{t("clienteForm.endereco")}</Label>
            <Input
              id="cliente-endereco"
              value={values.endereco}
              onChange={(e) => set("endereco", e.target.value)}
              placeholder={t("clienteForm.enderecoPlaceholder")}
              className="h-12 text-base"
              autoComplete="street-address"
            />
            {errors.endereco && <p className="text-xs text-destructive">{errors.endereco}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cliente-nif">{t("clienteForm.nif")}</Label>
            <Input
              id="cliente-nif"
              inputMode="numeric"
              value={values.nif}
              onChange={(e) => set("nif", e.target.value)}
              placeholder={t("clienteForm.nifPlaceholder")}
              className="h-12 text-base"
            />
            {errors.nif && <p className="text-xs text-destructive">{errors.nif}</p>}
          </div>

          <SheetFooter className="cliente-form-footer gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-full"
              onClick={() => onOpenChange(false)}
            >
              {t("comum.cancelar")}
            </Button>
            <Button type="submit" className="h-11 flex-1 rounded-full" disabled={submitting}>
              {isEdit ? t("comum.guardar") : t("clienteForm.adicionar")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
