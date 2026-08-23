import { useTranslation } from "react-i18next";
import type { EstadoPedido } from "@/lib/db";

const CLASSE: Record<EstadoPedido, string> = {
  pendente: "tag tag-outline",
  confirmado: "tag tag-accent-2",
  entregue: "tag tag-neutral",
  cancelado: "tag tag-neutral",
};

export function EstadoTag({ estado }: { estado: EstadoPedido }) {
  const { t } = useTranslation();
  return <span className={CLASSE[estado]}>{t(`estado.${estado}`)}</span>;
}
