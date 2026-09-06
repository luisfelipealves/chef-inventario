import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { type EstadoPedido, type Pedido } from "@/lib/db";
import {
  mudarEstadoPedido,
  entregarPedido,
  faltasParaEntrega,
  type FaltaEntrega,
} from "@/lib/producao";
import { EstadoTag } from "@/components/EstadoTag";

const ESTADOS: EstadoPedido[] = ["pendente", "confirmado", "entregue", "cancelado"];

/** Etiqueta de estado clicável: muda o estado do pedido sem abrir o formulário. */
export function EstadoSelect({ pedido }: { pedido: Pedido }) {
  const { t } = useTranslation();
  const [faltas, setFaltas] = useState<FaltaEntrega[] | null>(null);
  const [aEntregar, setAEntregar] = useState(false);

  function mostrarAvisos(avisos: string[]) {
    if (avisos.length === 0) toast.success(t("pedidos.entregueOk"));
    else avisos.forEach((a) => toast.warning(a));
  }

  async function entregar(produzirFaltas: boolean) {
    setAEntregar(true);
    try {
      const avisos = await entregarPedido(pedido, { produzirFaltas });
      mostrarAvisos(avisos);
      setFaltas(null);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : t("pedidos.erroEntregar"));
    } finally {
      setAEntregar(false);
    }
  }

  async function mudar(estado: EstadoPedido) {
    if (estado === pedido.estado) return;
    try {
      if (estado === "entregue") {
        const emFalta = await faltasParaEntrega(pedido);
        if (emFalta.length > 0) {
          setFaltas(emFalta);
          return;
        }
        await entregar(false);
        return;
      }
      await mudarEstadoPedido(pedido.id, estado);
      toast.success(t("pedidos.marcado", { estado: t(`estado.${estado}`).toLowerCase() }));
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : t("pedidos.erroEstado"));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("pedidos.mudarEstado")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            <EstadoTag estado={pedido.estado} />
            <ChevronDown
              size={13}
              strokeWidth={2.75}
              style={{ color: "var(--color-neutral-600)" }}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {ESTADOS.map((e) => (
            <DropdownMenuItem key={e} onSelect={() => void mudar(e)}>
              <span style={{ flex: 1 }}>{t(`estado.${e}`)}</span>
              {e === pedido.estado && <Check size={14} strokeWidth={2.75} />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!faltas} onOpenChange={(o) => !o && setFaltas(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pedidos.dosesInsuf")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pedidos.dosesInsufDesc", {
                lista: faltas
                  ?.map((f) =>
                    t("pedidos.dosesInsufItem", {
                      nome: f.receita.nome,
                      n: f.dosesNecessarias,
                      p: f.dosesNecessarias - f.faltam,
                    }),
                  )
                  .join(" · "),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-full" disabled={aEntregar}>
              {t("comum.cancelar")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-full"
              onClick={(e) => {
                e.preventDefault();
                void entregar(true);
              }}
              disabled={aEntregar}
            >
              {aEntregar ? t("pedidos.aRegistar") : t("pedidos.produzirEntregar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
