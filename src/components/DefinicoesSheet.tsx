import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, Upload, Database } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { toast } from "sonner";
import { db } from "@/lib/db";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  exportarBackup,
  importarBackup,
  validarBackup,
  abrirBackupNativo,
  emTauri,
  type BackupData,
  type ContagemBackup,
} from "@/lib/backup";

export function DefinicoesSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const hydrated = useHydrated();
  const contagem = useLiveQuery(async () => {
    if (!hydrated) return null;
    const [ingredientes, receitas, clientes, pedidos] = await Promise.all([
      db.ingredientes.count(),
      db.receitas.count(),
      db.clientes.count(),
      db.pedidos.count(),
    ]);
    return { ingredientes, receitas, clientes, pedidos };
  }, [hydrated]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [aExportar, setAExportar] = useState(false);
  const [pendente, setPendente] = useState<{
    dados: BackupData;
    contagem: ContagemBackup;
  } | null>(null);
  const [aImportar, setAImportar] = useState(false);

  async function exportar() {
    setAExportar(true);
    try {
      const nome = await exportarBackup();
      if (nome) toast.success(`Cópia de segurança guardada: ${nome}`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao exportar os dados.");
    } finally {
      setAExportar(false);
    }
  }

  function prepararImport(texto: string) {
    try {
      const { dados, contagem } = validarBackup(texto);
      setPendente({ dados, contagem });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ficheiro inválido.");
    }
  }

  async function iniciarImport() {
    if (emTauri()) {
      try {
        const texto = await abrirBackupNativo();
        if (texto) prepararImport(texto);
      } catch (err) {
        console.error(err);
        toast.error("Não foi possível abrir o ficheiro.");
      }
    } else {
      fileRef.current?.click();
    }
  }

  function escolherFicheiro(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => prepararImport(String(reader.result));
    reader.readAsText(file);
  }

  async function confirmarImport() {
    if (!pendente) return;
    setAImportar(true);
    try {
      await importarBackup(pendente.dados);
      toast.success("Dados importados com sucesso.");
      setPendente(null);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao importar os dados.");
    } finally {
      setAImportar(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-4 overflow-y-auto border-0 bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)] sm:max-w-[480px] sm:rounded-l-[32px]"
        >
          <SheetHeader>
            <span className="card-kicker">Definições</span>
            <SheetTitle className="font-heading text-2xl font-normal">
              Cópia de segurança
            </SheetTitle>
            <SheetDescription>
              Os dados vivem só neste dispositivo. Exporta um ficheiro para guardar ou migrar para
              um computador novo.
            </SheetDescription>
          </SheetHeader>

          {contagem && (
            <div className="detalhe-card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Database size={16} strokeWidth={2.75} />
                <span style={{ fontFamily: "var(--font-heading)", fontSize: 15 }}>
                  Dados atuais
                </span>
              </div>
              {[
                ["Ingredientes", contagem.ingredientes],
                ["Receitas", contagem.receitas],
                ["Clientes", contagem.clientes],
                ["Pedidos", contagem.pedidos],
              ].map(([label, n]) => (
                <div key={label as string} className="kv">
                  <span className="kv-label">{label}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{n}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="card-kicker">Exportar</span>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={exportar}
              disabled={aExportar}
              style={{ height: 44 }}
            >
              <Download size={16} strokeWidth={2.75} />
              {aExportar ? "A exportar…" : "Exportar cópia de segurança"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="card-kicker">Importar</span>
            <p style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
              Importar substitui todos os dados atuais. Faz uma exportação antes, por segurança.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={iniciarImport}
              style={{ height: 44 }}
            >
              <Upload size={16} strokeWidth={2.75} />
              Importar de ficheiro…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={escolherFicheiro}
              style={{ display: "none" }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!pendente} onOpenChange={(o) => !o && setPendente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importar e substituir dados?</AlertDialogTitle>
            <AlertDialogDescription>
              Vais substituir todos os dados atuais por: {pendente?.contagem.ingredientes}{" "}
              ingredientes, {pendente?.contagem.receitas} receitas, {pendente?.contagem.clientes}{" "}
              clientes e {pendente?.contagem.pedidos} pedidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarImport}
              disabled={aImportar}
              className="h-11 rounded-full"
            >
              {aImportar ? "A importar…" : "Substituir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
