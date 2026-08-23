import { useState } from "react";
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
import { db, type EstadoPedido, type Pedido } from "@/lib/db";
import { estadoLabel } from "@/lib/pedido-calc";
import { entregarPedido, faltasParaEntrega, type FaltaEntrega } from "@/lib/producao";
import { EstadoTag } from "@/components/EstadoTag";

const ESTADOS: EstadoPedido[] = ["pendente", "confirmado", "entregue", "cancelado"];

/** Etiqueta de estado clicável: muda o estado do pedido sem abrir o formulário. */
export function EstadoSelect({ pedido }: { pedido: Pedido }) {
  const [faltas, setFaltas] = useState<FaltaEntrega[] | null>(null);
  const [aEntregar, setAEntregar] = useState(false);

  function mostrarAvisos(avisos: string[]) {
    if (avisos.length === 0) toast.success("Pedido entregue — doses prontas atualizadas.");
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
      toast.error("Erro ao entregar o pedido.");
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
      await db.pedidos.update(pedido.id, { estado });
      toast.success(`Pedido marcado como ${estadoLabel[estado].toLowerCase()}`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar o estado");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Alterar estado do pedido"
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
              <span style={{ flex: 1 }}>{estadoLabel[e]}</span>
              {e === pedido.estado && <Check size={14} strokeWidth={2.75} />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!faltas} onOpenChange={(o) => !o && setFaltas(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Doses prontas insuficientes</AlertDialogTitle>
            <AlertDialogDescription>
              {faltas
                ?.map(
                  (f) =>
                    `${f.receita.nome}: precisas de ${f.dosesNecessarias}, tens ${
                      f.dosesNecessarias - f.faltam
                    } prontas`,
                )
                .join(" · ")}
              . Queres registar a produção em falta (em lotes inteiros, abatendo os ingredientes da
              despensa) antes de entregar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-full" disabled={aEntregar}>
              Cancelar
            </AlertDialogCancel>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ height: 44, borderRadius: 999 }}
              onClick={() => void entregar(false)}
              disabled={aEntregar}
            >
              Entregar sem produzir
            </button>
            <AlertDialogAction
              className="h-11 rounded-full"
              onClick={(e) => {
                e.preventDefault();
                void entregar(true);
              }}
              disabled={aEntregar}
            >
              {aEntregar ? "A registar…" : "Produzir e entregar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
