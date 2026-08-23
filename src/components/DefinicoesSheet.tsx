import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, Upload, Database, Trash2 } from "lucide-react";
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
import { apagarDadosExemplo, useTemDadosExemplo } from "@/lib/demo-data";
import {
  ultimoBackupAuto,
  usePastaBackupExtra,
  definirPastaBackupExtra,
  backupParaPasta,
} from "@/lib/backup-auto";
import { getGeminiKey, setGeminiKey } from "@/lib/fatura-ocr";
import { SeletorTema } from "@/components/SeletorTema";
import { SeletorIdioma } from "@/components/SeletorIdioma";
import { Input } from "@/components/ui/input";
import {
  gravarNome,
  useNomeUtilizador,
  useNomeNegocio,
  gravarNomeNegocio,
  useLogoNegocio,
  gravarLogoNegocio,
  carregarLogoDeFicheiro,
} from "@/lib/perfil";

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

  const pastaExtra = usePastaBackupExtra();
  const temDemo = useTemDadosExemplo();
  const [confirmarDemo, setConfirmarDemo] = useState(false);
  const [aApagarDemo, setAApagarDemo] = useState(false);

  const nomeAtual = useNomeUtilizador() ?? "";
  const [nomeInput, setNomeInput] = useState(nomeAtual);
  useEffect(() => {
    if (open) setNomeInput(nomeAtual);
  }, [open, nomeAtual]);

  function guardarNomePerfil() {
    gravarNome(nomeInput);
    toast.success(
      nomeInput.trim() ? `Nome atualizado para ${nomeInput.trim()}.` : "Nome removido.",
    );
  }

  const negocioAtual = useNomeNegocio();
  const [negocioInput, setNegocioInput] = useState(negocioAtual);
  useEffect(() => {
    if (open) setNegocioInput(negocioAtual);
  }, [open, negocioAtual]);
  const logo = useLogoNegocio();
  const logoRef = useRef<HTMLInputElement>(null);

  function guardarNegocio() {
    gravarNomeNegocio(negocioInput);
    toast.success(negocioInput.trim() ? "Nome do negócio guardado." : "Nome do negócio removido.");
  }

  async function escolherLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const ficheiro = e.target.files?.[0];
    e.target.value = "";
    if (!ficheiro) return;
    try {
      const dataUrl = await carregarLogoDeFicheiro(ficheiro);
      if (gravarLogoNegocio(dataUrl)) toast.success("Logótipo guardado.");
      else toast.error("Imagem demasiado grande para guardar. Tenta uma mais pequena.");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível ler a imagem.");
    }
  }

  function removerLogo() {
    gravarLogoNegocio("");
    toast.success("Logótipo removido.");
  }

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

  const [chaveInput, setChaveInput] = useState("");
  const [temChave, setTemChave] = useState(false);
  useEffect(() => {
    if (open) {
      setTemChave(Boolean(getGeminiKey()));
      setChaveInput("");
    }
  }, [open]);

  function guardarChaveGemini() {
    setGeminiKey(chaveInput);
    setTemChave(Boolean(chaveInput.trim()));
    setChaveInput("");
    toast.success("Chave guardada — a leitura de faturas está ativa.");
  }

  function removerChaveGemini() {
    setGeminiKey("");
    setTemChave(false);
    toast.success("Chave removida.");
  }

  async function copiarLinkChave() {
    try {
      await navigator.clipboard.writeText("https://aistudio.google.com/apikey");
      toast.success("Link copiado — abre-o no browser.");
    } catch {
      toast.error("Não foi possível copiar. O endereço é aistudio.google.com/apikey");
    }
  }

  async function escolherPastaBackup() {
    try {
      const { open: abrirDialogo } = await import("@tauri-apps/plugin-dialog");
      const dir = await abrirDialogo({
        directory: true,
        multiple: false,
        title: "Pasta para os backups automáticos",
      });
      if (typeof dir !== "string") return;
      definirPastaBackupExtra(dir);
      await backupParaPasta(dir);
      toast.success("Pasta definida — o backup de hoje já ficou guardado lá.");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível definir a pasta de backup.");
    }
  }

  function removerPastaBackup() {
    definirPastaBackupExtra(null);
    toast.success("Backup para pasta adicional desativado.");
  }

  async function confirmarApagarDemo() {
    setAApagarDemo(true);
    try {
      await apagarDadosExemplo();
      toast.success("Dados de exemplo apagados.");
      setConfirmarDemo(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao apagar os dados de exemplo.");
    } finally {
      setAApagarDemo(false);
    }
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
              Perfil e cópia de segurança
            </SheetTitle>
            <SheetDescription>
              Os dados vivem só neste dispositivo. Exporta um ficheiro para guardar ou migrar para
              um computador novo.
            </SheetDescription>
          </SheetHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="card-kicker">Perfil</span>
            <p style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
              O nome usado na saudação do painel.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                guardarNomePerfil();
              }}
              style={{ display: "flex", gap: 8 }}
            >
              <Input
                value={nomeInput}
                onChange={(e) => setNomeInput(e.target.value)}
                placeholder="O teu nome"
                maxLength={40}
                className="h-11"
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={nomeInput.trim() === nomeAtual}
                style={{ height: 44 }}
              >
                Guardar
              </button>
            </form>

            <p style={{ fontSize: 12, color: "var(--color-neutral-700)", marginTop: 6 }}>
              O nome do negócio e o logótipo aparecem no cabeçalho dos PDFs de orçamento e resumo do
              pedido.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                guardarNegocio();
              }}
              style={{ display: "flex", gap: 8 }}
            >
              <Input
                value={negocioInput}
                onChange={(e) => setNegocioInput(e.target.value)}
                placeholder="Nome do negócio (ex.: Doces da Maria)"
                maxLength={60}
                className="h-11"
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={negocioInput.trim() === negocioAtual}
                style={{ height: 44 }}
              >
                Guardar
              </button>
            </form>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {logo && (
                <img
                  src={logo}
                  alt="Logótipo do negócio"
                  style={{
                    height: 44,
                    width: 44,
                    objectFit: "contain",
                    borderRadius: 10,
                    border: "1px solid var(--color-divider)",
                    background: "#fff",
                  }}
                />
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => logoRef.current?.click()}
                style={{ height: 38, flex: 1 }}
              >
                {logo ? "Mudar logótipo…" : "Escolher logótipo…"}
              </button>
              {logo && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={removerLogo}
                  style={{ height: 38 }}
                >
                  Remover
                </button>
              )}
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                onChange={(e) => void escolherLogo(e)}
                style={{ display: "none" }}
              />
            </div>
          </div>

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
            {emTauri() && (
              <p style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                A app guarda sozinha um backup por dia no arranque (últimos 60 dias, na pasta da
                aplicação).{" "}
                {ultimoBackupAuto() ? `Último: ${ultimoBackupAuto()}.` : "Ainda nenhum."}
              </p>
            )}
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

          {emTauri() && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="card-kicker">Backup na nuvem</span>
              <p style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                Escolhe uma pasta sincronizada (iCloud Drive, Google Drive, Dropbox…) e o backup
                diário fica também lá — a nuvem trata do resto.
              </p>
              {pastaExtra && (
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--color-neutral-600)",
                    fontVariantNumeric: "tabular-nums",
                    wordBreak: "break-all",
                  }}
                >
                  {pastaExtra}
                </p>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void escolherPastaBackup()}
                  style={{ height: 44, flex: 1 }}
                >
                  {pastaExtra ? "Mudar pasta…" : "Escolher pasta…"}
                </button>
                {pastaExtra && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={removerPastaBackup}
                    style={{ height: 44 }}
                  >
                    Desativar
                  </button>
                )}
              </div>
            </div>
          )}

          <SeletorTema />

          <SeletorIdioma />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="card-kicker">Leitura de faturas (IA)</span>
            <p style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
              Funcionalidade opcional: fotografa um talão e o stock atualiza-se sozinho. Usa a API
              gratuita do Google Gemini com uma chave tua, guardada só neste dispositivo — sem
              chave, a app funciona na mesma e registas as compras manualmente.
            </p>
            {temChave ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ fontSize: 12, flex: 1 }}>
                  Chave configurada — a leitura de faturas está ativa.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={removerChaveGemini}
                  style={{ height: 38 }}
                >
                  Remover
                </button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                  1. Abre <span style={{ fontWeight: 600 }}>aistudio.google.com/apikey</span> no
                  browser (conta Google, grátis) · 2. "Create API key" · 3. Cola a chave aqui.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    guardarChaveGemini();
                  }}
                  style={{ display: "flex", gap: 8 }}
                >
                  <Input
                    type="password"
                    value={chaveInput}
                    onChange={(e) => setChaveInput(e.target.value)}
                    placeholder="Chave da API do Gemini"
                    className="h-11"
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!chaveInput.trim()}
                    style={{ height: 44 }}
                  >
                    Guardar
                  </button>
                </form>
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={() => void copiarLinkChave()}
                  style={{ height: 38 }}
                >
                  Copiar link para obter a chave
                </button>
              </>
            )}
          </div>

          {temDemo && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="card-kicker">Dados de exemplo</span>
              <p style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                A app tem dados de exemplo do onboarding. Apaga-os quando quiseres começar a usar os
                teus dados reais — os registos criados por ti ficam intactos.
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => setConfirmarDemo(true)}
                style={{ height: 44 }}
              >
                <Trash2 size={16} strokeWidth={2.75} />
                Apagar dados de exemplo
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmarDemo} onOpenChange={(o) => !o && setConfirmarDemo(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar os dados de exemplo?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove os ingredientes, receitas, clientes, pedidos e compras criados no onboarding.
              Os dados que criaste manualmente não são afetados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarApagarDemo}
              disabled={aApagarDemo}
              className="h-11 rounded-full"
            >
              {aApagarDemo ? "A apagar…" : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
