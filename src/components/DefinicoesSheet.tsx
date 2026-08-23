import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      nomeInput.trim()
        ? t("definicoes.nomeAtualizado", { nome: nomeInput.trim() })
        : t("definicoes.nomeRemovido"),
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
    toast.success(
      negocioInput.trim() ? t("definicoes.negocioGuardado") : t("definicoes.negocioRemovido"),
    );
  }

  async function escolherLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const ficheiro = e.target.files?.[0];
    e.target.value = "";
    if (!ficheiro) return;
    try {
      const dataUrl = await carregarLogoDeFicheiro(ficheiro);
      if (gravarLogoNegocio(dataUrl)) toast.success(t("definicoes.logoGuardado"));
      else toast.error(t("definicoes.logoGrande"));
    } catch (err) {
      console.error(err);
      toast.error(t("definicoes.logoIlegivel"));
    }
  }

  function removerLogo() {
    gravarLogoNegocio("");
    toast.success(t("definicoes.logoRemovido"));
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
      if (nome) toast.success(t("definicoes.backupGuardado", { nome }));
    } catch (err) {
      console.error(err);
      toast.error(t("definicoes.erroExportar"));
    } finally {
      setAExportar(false);
    }
  }

  function prepararImport(texto: string) {
    try {
      const { dados, contagem } = validarBackup(texto);
      setPendente({ dados, contagem });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("backupLib.jsonIlegivel"));
    }
  }

  async function iniciarImport() {
    if (emTauri()) {
      try {
        const texto = await abrirBackupNativo();
        if (texto) prepararImport(texto);
      } catch (err) {
        console.error(err);
        toast.error(t("definicoes.erroAbrirFicheiro"));
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
    toast.success(t("definicoes.iaGuardada"));
  }

  function removerChaveGemini() {
    setGeminiKey("");
    setTemChave(false);
    toast.success(t("definicoes.iaRemovida"));
  }

  async function copiarLinkChave() {
    try {
      await navigator.clipboard.writeText("https://aistudio.google.com/apikey");
      toast.success(t("definicoes.linkCopiado"));
    } catch {
      toast.error(t("definicoes.erroCopiar"));
    }
  }

  async function escolherPastaBackup() {
    try {
      const { open: abrirDialogo } = await import("@tauri-apps/plugin-dialog");
      const dir = await abrirDialogo({
        directory: true,
        multiple: false,
        title: t("definicoes.pastaTitulo"),
      });
      if (typeof dir !== "string") return;
      definirPastaBackupExtra(dir);
      await backupParaPasta(dir);
      toast.success(t("definicoes.pastaDefinida"));
    } catch (err) {
      console.error(err);
      toast.error(t("definicoes.erroPasta"));
    }
  }

  function removerPastaBackup() {
    definirPastaBackupExtra(null);
    toast.success(t("definicoes.pastaDesativada"));
  }

  async function confirmarApagarDemo() {
    setAApagarDemo(true);
    try {
      await apagarDadosExemplo();
      toast.success(t("definicoes.demoApagados"));
      setConfirmarDemo(false);
    } catch (err) {
      console.error(err);
      toast.error(t("definicoes.erroDemoApagar"));
    } finally {
      setAApagarDemo(false);
    }
  }

  async function confirmarImport() {
    if (!pendente) return;
    setAImportar(true);
    try {
      await importarBackup(pendente.dados);
      toast.success(t("definicoes.importado"));
      setPendente(null);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(t("definicoes.erroImportar"));
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
            <span className="card-kicker">{t("definicoes.kicker")}</span>
            <SheetTitle className="font-heading text-2xl font-normal">
              {t("definicoes.titulo")}
            </SheetTitle>
            <SheetDescription>{t("definicoes.desc")}</SheetDescription>
          </SheetHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="card-kicker">{t("definicoes.perfil")}</span>
            <p style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
              {t("definicoes.perfilDesc")}
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
                placeholder={t("definicoes.teuNome")}
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
              {t("definicoes.negocioDesc")}
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
                placeholder={t("definicoes.negocioPlaceholder")}
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
                  alt={t("definicoes.logoAlt")}
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
                {logo ? t("definicoes.mudarLogo") : t("definicoes.escolherLogo")}
              </button>
              {logo && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={removerLogo}
                  style={{ height: 38 }}
                >
                  {t("comum.remover")}
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
                  {t("definicoes.dadosAtuais")}
                </span>
              </div>
              {[
                [t("nav.ingredientes"), contagem.ingredientes],
                [t("nav.receitas"), contagem.receitas],
                [t("nav.clientes"), contagem.clientes],
                [t("nav.pedidos"), contagem.pedidos],
              ].map(([label, n]) => (
                <div key={label as string} className="kv">
                  <span className="kv-label">{label}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{n}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="card-kicker">{t("definicoes.exportar")}</span>
            {emTauri() && (
              <p style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                {t("definicoes.autoBackup")}{" "}
                {ultimoBackupAuto()
                  ? t("definicoes.autoBackupUltimo", { data: ultimoBackupAuto() })
                  : t("definicoes.autoBackupNenhum")}
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
              {aExportar ? t("definicoes.aExportar") : t("definicoes.exportarBtn")}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="card-kicker">{t("definicoes.importar")}</span>
            <p style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
              {t("definicoes.importarAviso")}
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={iniciarImport}
              style={{ height: 44 }}
            >
              <Upload size={16} strokeWidth={2.75} />
              {t("definicoes.importarBtn")}
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
              <span className="card-kicker">{t("definicoes.nuvem")}</span>
              <p style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                {t("definicoes.nuvemDesc")}
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
                  {pastaExtra ? t("definicoes.mudarPasta") : t("definicoes.escolherPasta")}
                </button>
                {pastaExtra && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={removerPastaBackup}
                    style={{ height: 44 }}
                  >
                    {t("definicoes.desativar")}
                  </button>
                )}
              </div>
            </div>
          )}

          <SeletorTema />

          <SeletorIdioma />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="card-kicker">{t("definicoes.ia")}</span>
            <p style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
              {t("definicoes.iaDesc")}
            </p>
            {temChave ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ fontSize: 12, flex: 1 }}>{t("definicoes.iaConfigurada")}</p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={removerChaveGemini}
                  style={{ height: 38 }}
                >
                  {t("comum.remover")}
                </button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                  {t("definicoes.iaPassos", { site: "aistudio.google.com/apikey" })}
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
                    placeholder={t("fatura.chavePlaceholder")}
                    className="h-11"
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!chaveInput.trim()}
                    style={{ height: 44 }}
                  >
                    {t("comum.guardar")}
                  </button>
                </form>
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={() => void copiarLinkChave()}
                  style={{ height: 38 }}
                >
                  {t("definicoes.copiarLink")}
                </button>
              </>
            )}
          </div>

          {temDemo && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="card-kicker">{t("definicoes.demo")}</span>
              <p style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                {t("definicoes.demoDesc")}
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => setConfirmarDemo(true)}
                style={{ height: 44 }}
              >
                <Trash2 size={16} strokeWidth={2.75} />
                {t("definicoes.demoApagarBtn")}
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmarDemo} onOpenChange={(o) => !o && setConfirmarDemo(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("definicoes.demoTitulo")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("definicoes.demoDialogo")} {t("comum.acaoIrreversivel")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-full">
              {t("comum.cancelar")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarApagarDemo}
              disabled={aApagarDemo}
              className="h-11 rounded-full"
            >
              {aApagarDemo ? t("definicoes.aApagar") : t("definicoes.apagar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendente} onOpenChange={(o) => !o && setPendente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("definicoes.importarTitulo")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("definicoes.importarDesc", {
                ingredientes: pendente?.contagem.ingredientes ?? 0,
                receitas: pendente?.contagem.receitas ?? 0,
                clientes: pendente?.contagem.clientes ?? 0,
                pedidos: pendente?.contagem.pedidos ?? 0,
              })}{" "}
              {t("comum.acaoIrreversivel")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-full">
              {t("comum.cancelar")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarImport}
              disabled={aImportar}
              className="h-11 rounded-full"
            >
              {aImportar ? t("definicoes.aImportar") : t("definicoes.substituir")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
