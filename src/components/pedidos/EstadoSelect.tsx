import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { db, type EstadoPedido, type Pedido } from "@/lib/db";
import { estadoLabel } from "@/lib/pedido-calc";
import { EstadoTag } from "@/components/EstadoTag";

const ESTADOS: EstadoPedido[] = ["pendente", "confirmado", "entregue", "cancelado"];

/** Etiqueta de estado clicável: muda o estado do pedido sem abrir o formulário. */
export function EstadoSelect({ pedido }: { pedido: Pedido }) {
  async function mudar(estado: EstadoPedido) {
    if (estado === pedido.estado) return;
    try {
      await db.pedidos.update(pedido.id, { estado });
      toast.success(`Pedido marcado como ${estadoLabel[estado].toLowerCase()}`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar o estado");
    }
  }

  return (
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
          <ChevronDown size={13} strokeWidth={2.75} style={{ color: "var(--color-neutral-600)" }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {ESTADOS.map((e) => (
          <DropdownMenuItem key={e} onSelect={() => mudar(e)}>
            <span style={{ flex: 1 }}>{estadoLabel[e]}</span>
            {e === pedido.estado && <Check size={14} strokeWidth={2.75} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
