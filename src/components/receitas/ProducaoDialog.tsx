import { useEffect, useState } from "react";
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
import type { Ingrediente, Receita } from "@/lib/db";
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
  const [lotesInput, setLotesInput] = useState("1");
  const [aGravar, setAGravar] = useState(false);
  useEffect(() => {
    if (open) setLotesInput("1");
  }, [open]);

  const lotes = Math.max(0, Math.floor(Number(lotesInput) || 0));
  const doses = lotes * receita.rendimento;

  async function confirmar() {
    if (lotes <= 0) return;
    setAGravar(true);
    try {
      const faltas = await registarProducao(receita, lotes);
      if (faltas.length === 0) {
        toast.success(`Produção registada: ${doses} ${receita.unidadeRendimento} prontas.`);
      } else {
        toast.warning(
          `Produção registada, mas a despensa ficou curta: ${faltas
            .map((f) => `${f.nome} (−${Math.round(f.falta * 100) / 100} ${f.unidade})`)
            .join(", ")}. Confirma o stock real.`,
        );
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao registar a produção.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registar produção</DialogTitle>
          <DialogDescription>
            {receita.nome} — cada lote rende {receita.rendimento} {receita.unidadeRendimento}. Os
            ingredientes baixam na despensa.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            {lotes === 1 ? "lote" : "lotes"} → {doses} {receita.unidadeRendimento} prontas
          </span>
        </div>

        {lotes > 0 && (
          <div className="detalhe-card" style={{ padding: "12px 16px" }}>
            {receita.ingredientes.map((l, i) => {
              const ing = ingMap.get(l.ingredienteId);
              if (!ing) return null;
              const necessario = l.quantidade * lotes;
              const curto = necessario > ing.quantidadeEmbalagem;
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
                    {curto ? ` (só tens ${Math.round(ing.quantidadeEmbalagem * 100) / 100})` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 flex-1"
            disabled={aGravar}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void confirmar()}
            disabled={lotes <= 0 || aGravar}
            className="h-11 flex-1"
          >
            <CookingPot size={16} strokeWidth={2.75} />
            {aGravar ? "A registar…" : "Registar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
