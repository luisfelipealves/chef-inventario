import type { EstadoPedido } from "@/lib/db";
import { estadoLabel } from "@/lib/pedido-calc";

const CLASSE: Record<EstadoPedido, string> = {
  pendente: "tag tag-outline",
  confirmado: "tag tag-accent-2",
  entregue: "tag tag-neutral",
  cancelado: "tag tag-neutral",
};

export function EstadoTag({ estado }: { estado: EstadoPedido }) {
  return <span className={CLASSE[estado]}>{estadoLabel[estado]}</span>;
}
