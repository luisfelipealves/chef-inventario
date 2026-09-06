import { useTranslation } from "react-i18next";
import { formatEuro } from "@/lib/format";

export function AvisoCusto({ completo }: { completo: boolean }) {
  const { t } = useTranslation();
  return (
    <p
      role={completo ? undefined : "status"}
      className="text-sm"
      style={{
        color: completo ? "var(--color-neutral-600)" : "var(--color-accent-700)",
        margin: "8px 0",
      }}
    >
      {t(completo ? "custos.limite" : "custos.incompleto")}
    </p>
  );
}

export function ResumoIndicadores({
  resultado,
  margem,
  acrescimo,
}: {
  resultado: number;
  margem: number | null;
  acrescimo: number | null;
}) {
  const { t } = useTranslation();
  const percentagem = (n: number | null) =>
    n != null && Number.isFinite(n) ? `${n.toFixed(1)}%` : "—";
  return (
    <div className="space-y-2 text-sm">
      <div>
        {t("custos.resultado")}:{" "}
        <strong style={{ color: resultado < 0 ? "var(--color-accent-700)" : undefined }}>
          {formatEuro(resultado)}
        </strong>
      </div>
      <div>
        {t("custos.margem")}: <strong>{percentagem(margem)}</strong>
      </div>
      <div>
        {t("custos.acrescimo")}: <strong>{percentagem(acrescimo)}</strong>
      </div>
      <p className="text-muted-foreground">{t("custos.explicacao")}</p>
    </div>
  );
}
