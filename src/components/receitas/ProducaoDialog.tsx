import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CookingPot } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { stockDe, type Ingrediente, type Receita } from "@/lib/db";
import { registarProducao } from "@/lib/producao";

/**
 * "Fiz esta receita": escolhe quantos lotes, mostra o que vai ser abatido
 * na despensa e regista a produção (doses prontas sobem).
 */
export function ProducaoDialog({
  open,
  onOpenChange,
  receita,
  ingMap,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receita: Receita;
  ingMap: Map<number, Ingrediente>;
}) {
  const { t } = useTranslation();
  const [lotesInput, setLotesInput] = useState("1");
  const [aGravar, setAGravar] = useState(false);
  useEffect(() => {
    if (open) setLotesInput("1");
  }, [open]);

  const lotes = Number(lotesInput);
  const lotesValidos = Number.isFinite(lotes) && Number.isInteger(lotes) && lotes > 0;
  const doses = lotes * receita.rendimento;

  async function confirmar() {
    if (!lotesValidos) return;
    setAGravar(true);
    try {
      const faltas = await registarProducao(receita, lotes);
      if (faltas.length === 0) {
        toast.success(t("producaoDialog.ok", { doses, unidade: receita.unidadeRendimento }));
      } else {
        toast.warning(
          t("producaoDialog.curta", {
            lista: faltas
              .map((f) => `${f.nome} (−${Math.round(f.falta * 100) / 100} ${f.unidade})`)
              .join(", "),
          }),
        );
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : t("producaoDialog.erro"));
    } finally {
      setAGravar(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="producao-dialog sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("producaoDialog.titulo")}</DialogTitle>
          <DialogDescription>
            {t("producaoDialog.desc", {
              nome: receita.nome,
              rendimento: receita.rendimento,
              unidade: receita.unidadeRendimento,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="producao-lotes" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Input
            type="number"
            min={1}
            step={1}
            value={lotesInput}
            onChange={(e) => setLotesInput(e.target.value)}
            className="h-11 w-24"
            autoFocus
          />
          <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
            {t("producaoDialog.lote", { count: lotes })}{" "}
            {t("producaoDialog.resultado", { doses, unidade: receita.unidadeRendimento })}
          </span>
        </div>

        {lotes > 0 && (
          <div className="detalhe-card producao-details" style={{ padding: "12px 16px" }}>
            {receita.ingredientes.map((l, i) => {
              const ing = ingMap.get(l.ingredienteId);
              if (!ing) return null;
              const necessario = l.quantidade * lotes;
              const stock = stockDe(ing);
              const curto = necessario > stock;
              return (
                <div key={i} className="kv" style={{ alignItems: "baseline" }}>
                  <span style={{ flex: 1, minWidth: 0 }}>{ing.nome}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontVariantNumeric: "tabular-nums",
                      color: curto ? "var(--color-accent-700)" : "var(--color-neutral-600)",
                      fontWeight: curto ? 600 : 400,
                    }}
                  >
                    −{Math.round(necessario * 100) / 100} {ing.unidade}
                    {curto
                      ? t("producaoDialog.soTens", {
                          n: Math.round(stock * 100) / 100,
                        })
                      : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="producao-actions" style={{ display: "flex", gap: 8 }}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 flex-1"
            disabled={aGravar}
          >
            {t("comum.cancelar")}
          </Button>
          <Button
            onClick={() => void confirmar()}
            disabled={!lotesValidos || aGravar}
            className="h-11 flex-1"
          >
            <CookingPot size={16} strokeWidth={2.75} />
            {aGravar ? t("producaoDialog.aRegistar") : t("producaoDialog.registar")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
