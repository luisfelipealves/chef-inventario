import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
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
import { useHydrated } from "@/hooks/use-hydrated";
import { gravarNome, useNomeUtilizador } from "@/lib/perfil";
import { criarDadosExemplo } from "@/lib/demo-data";

/**
 * Onboarding do primeiro arranque: pergunta o nome e oferece dados de
 * exemplo. Fechar sem responder grava "" para não voltar a perguntar.
 */
export function PrimeiroArranqueDialog() {
  const { t } = useTranslation();
  const hydrated = useHydrated();
  const nome = useNomeUtilizador();
  const [valor, setValor] = useState("");
  const [etapa, setEtapa] = useState<"nome" | "exemplo">("nome");
  const [fechado, setFechado] = useState(false);
  const [aCriar, setACriar] = useState(false);

  const open = hydrated && !fechado && (nome === null || etapa === "exemplo");

  function avancar() {
    gravarNome(valor);
    setEtapa("exemplo");
  }

  async function carregarExemplo() {
    setACriar(true);
    try {
      await criarDadosExemplo();
      toast.success(t("onboarding.exemploCriado"));
      setFechado(true);
    } catch (err) {
      console.error(err);
      toast.error(t("onboarding.erroExemplo"));
    } finally {
      setACriar(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) return;
        if (etapa === "nome") gravarNome("");
        setFechado(true);
      }}
    >
      <DialogContent className="onboarding-dialog sm:max-w-sm">
        {etapa === "nome" ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("onboarding.bemVindo")}</DialogTitle>
              <DialogDescription>{t("onboarding.comoTeChamas")}</DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                avancar();
              }}
              className="flex flex-col gap-3"
            >
              <Input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={t("onboarding.teuNome")}
                autoFocus
                maxLength={40}
              />
              <Button type="submit" disabled={!valor.trim()} className="h-11 w-full">
                {t("onboarding.continuar")}
              </Button>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("onboarding.comoComecar")}</DialogTitle>
              <DialogDescription>{t("onboarding.comecarDesc")}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Button onClick={carregarExemplo} disabled={aCriar} className="h-11 w-full">
                <Sparkles size={16} strokeWidth={2.75} />
                {aCriar ? t("onboarding.aCriar") : t("onboarding.carregarExemplo")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setFechado(true)}
                disabled={aCriar}
                className="h-11 w-full"
              >
                {t("onboarding.comecarVazio")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
