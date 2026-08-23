import { useState } from "react";
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
      toast.success("Dados de exemplo criados. Podes apagá-los nas Definições.");
      setFechado(true);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar os dados de exemplo.");
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
      <DialogContent className="sm:max-w-sm">
        {etapa === "nome" ? (
          <>
            <DialogHeader>
              <DialogTitle>Bem-vindo ao Caderninho de Receitas!</DialogTitle>
              <DialogDescription>
                Como te chamas? Usamos o teu nome para te dar as boas-vindas.
              </DialogDescription>
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
                placeholder="O teu nome"
                autoFocus
                maxLength={40}
              />
              <Button type="submit" disabled={!valor.trim()} className="h-11 w-full">
                Continuar
              </Button>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Como queres começar?</DialogTitle>
              <DialogDescription>
                Podes explorar a app já com ingredientes, receitas e pedidos de exemplo — e
                apagá-los a qualquer momento nas Definições.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Button onClick={carregarExemplo} disabled={aCriar} className="h-11 w-full">
                <Sparkles size={16} strokeWidth={2.75} />
                {aCriar ? "A criar…" : "Carregar dados de exemplo"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setFechado(true)}
                disabled={aCriar}
                className="h-11 w-full"
              >
                Começar vazio
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
