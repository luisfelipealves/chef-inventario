import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Upload, X, KeyRound } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { db, type Compra, type Ingrediente, type UnidadeMedida } from "@/lib/db";
import { custoPorUnidade, formatEuro } from "@/lib/format";
import { getGeminiKey, setGeminiKey, lerFatura, type ItemFatura } from "@/lib/fatura-ocr";

type Etapa = "chave" | "captura" | "processar" | "rever";

interface Linha {
  nome: string;
  quantidade: string;
  unidade: UnidadeMedida;
  precoTotal: string;
  match: number | "novo";
}

const UNIDADES: UnidadeMedida[] = ["g", "kg", "ml", "l", "un"];

function melhorMatch(nome: string, ingredientes: Ingrediente[]): number | "novo" {
  const alvo = nome.toLowerCase();
  const achado = ingredientes.find((i) => {
    const n = i.nome.toLowerCase();
    return n === alvo || n.includes(alvo) || alvo.includes(n);
  });
  return achado ? achado.id : "novo";
}

export function FaturaSheet({
  open,
  onOpenChange,
  ingredientes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredientes: Ingrediente[];
}) {
  const [etapa, setEtapa] = useState<Etapa>("captura");
  const [chaveInput, setChaveInput] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [aGravar, setAGravar] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ingMap = useMemo(() => new Map(ingredientes.map((i) => [i.id, i])), [ingredientes]);

  function pararCamara() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // Estado inicial ao abrir: pede chave se não houver, senão vai para captura.
  useEffect(() => {
    if (!open) {
      pararCamara();
      return;
    }
    setErro(null);
    setLinhas([]);
    if (!getGeminiKey()) {
      setEtapa("chave");
    } else {
      setEtapa("captura");
    }
  }, [open]);

  // Liga a câmara quando entramos na etapa de captura.
  useEffect(() => {
    if (!open || etapa !== "captura") return;
    let cancelado = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        // Sem câmara: o utilizador pode usar o upload de ficheiro.
      }
    })();
    return () => {
      cancelado = true;
      pararCamara();
    };
  }, [open, etapa]);

  useEffect(() => () => pararCamara(), []);

  async function processar(base64: string) {
    setEtapa("processar");
    setErro(null);
    try {
      const itens = await lerFatura(base64, getGeminiKey());
      if (itens.length === 0) {
        setErro("Nenhum produto reconhecido. Tenta uma foto mais nítida.");
        setEtapa("captura");
        return;
      }
      setLinhas(
        itens.map((it: ItemFatura) => ({
          nome: it.nome,
          quantidade: String(it.quantidade),
          unidade: it.unidade,
          precoTotal: String(it.precoTotal),
          match: melhorMatch(it.nome, ingredientes),
        })),
      );
      setEtapa("rever");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao ler a fatura.");
      setEtapa("captura");
    }
  }

  function tirarFoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setErro("Câmara ainda não pronta. Aguarda um instante.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
    pararCamara();
    processar(base64);
  }

  function onFicheiro(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result);
      const base64 = res.split(",")[1];
      if (base64) {
        pararCamara();
        processar(base64);
      }
    };
    reader.readAsDataURL(file);
  }

  function guardarChave() {
    if (!chaveInput.trim()) return;
    setGeminiKey(chaveInput);
    setChaveInput("");
    setEtapa("captura");
  }

  function setLinha(idx: number, patch: Partial<Linha>) {
    setLinhas((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function confirmar() {
    setAGravar(true);
    try {
      let criados = 0;
      let atualizados = 0;
      for (const l of linhas) {
        const quantidade = Number(l.quantidade) || 0;
        const preco = Number(l.precoTotal) || 0;
        if (quantidade <= 0) continue;

        if (l.match === "novo") {
          const novoId = await db.ingredientes.add({
            nome: l.nome.trim(),
            unidade: l.unidade,
            quantidadeEmbalagem: quantidade,
            precoEmbalagem: preco,
            createdAt: new Date(),
          } as Ingrediente);
          await db.compras.add({
            ingredienteId: novoId as number,
            nome: l.nome.trim(),
            quantidade,
            unidade: l.unidade,
            valor: preco,
            createdAt: new Date(),
          } as Compra);
          criados++;
        } else {
          const ing = ingMap.get(l.match);
          if (!ing) continue;
          const novaQuantidade = ing.quantidadeEmbalagem + quantidade;
          const custoUnitario = quantidade > 0 ? preco / quantidade : 0;
          await db.ingredientes.update(ing.id, {
            quantidadeEmbalagem: novaQuantidade,
            precoEmbalagem: custoUnitario * novaQuantidade,
          });
          await db.compras.add({
            ingredienteId: ing.id,
            nome: ing.nome,
            quantidade,
            unidade: ing.unidade,
            valor: preco,
            createdAt: new Date(),
          } as Compra);
          atualizados++;
        }
      }
      toast.success(`Stock atualizado: ${atualizados} compra(s), ${criados} novo(s).`);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar o stock.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-4 overflow-hidden border-0 bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)] sm:max-w-[480px] sm:rounded-l-[32px]"
      >
        <SheetHeader>
          <span className="card-kicker">Ingredientes</span>
          <SheetTitle className="font-heading text-2xl font-normal">Ler fatura</SheetTitle>
          <SheetDescription>
            Fotografa o talão de compras e atualiza o stock automaticamente.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
          {erro && <p style={{ fontSize: 13, color: "var(--color-accent-700)" }}>{erro}</p>}

          {etapa === "chave" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                className="detalhe-card"
                style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
              >
                <KeyRound size={18} strokeWidth={2.75} style={{ flex: "none", marginTop: 2 }} />
                <p style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
                  Esta função usa a API gratuita do Google Gemini. Cola aqui a tua chave (é guardada
                  só neste dispositivo). Obténs uma grátis em{" "}
                  <span style={{ fontWeight: 600 }}>aistudio.google.com/apikey</span>.
                </p>
              </div>
              <input
                type="password"
                value={chaveInput}
                onChange={(e) => setChaveInput(e.target.value)}
                placeholder="Chave da API do Gemini"
                style={{
                  height: 42,
                  borderRadius: 999,
                  border: "1px solid var(--color-divider)",
                  background: "var(--color-surface)",
                  padding: "0 16px",
                  fontSize: 14,
                }}
              />
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={guardarChave}
                style={{ height: 44 }}
              >
                Guardar chave
              </button>
            </div>
          )}

          {etapa === "captura" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  borderRadius: 22,
                  overflow: "hidden",
                  background: "#000",
                  aspectRatio: "4 / 3",
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    // Espelha só a pré-visualização; a foto capturada (canvas) não é espelhada
                    transform: "scaleX(-1)",
                  }}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={tirarFoto}
                style={{ height: 44 }}
              >
                <Camera size={16} strokeWidth={2.75} />
                Tirar foto
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => fileRef.current?.click()}
                style={{ height: 44 }}
              >
                <Upload size={16} strokeWidth={2.75} />
                Escolher imagem
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onFicheiro}
                style={{ display: "none" }}
              />
            </div>
          )}

          {etapa === "processar" && (
            <p
              style={{
                fontSize: 14,
                color: "var(--color-neutral-600)",
                padding: "24px 0",
                textAlign: "center",
              }}
            >
              A ler a fatura…
            </p>
          )}

          {etapa === "rever" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {linhas.map((l, idx) => {
                const custoU =
                  Number(l.quantidade) > 0
                    ? custoPorUnidade(Number(l.precoTotal) || 0, Number(l.quantidade))
                    : 0;
                return (
                  <div
                    key={idx}
                    className="detalhe-card"
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        value={l.nome}
                        onChange={(e) => setLinha(idx, { nome: e.target.value })}
                        style={campoNome}
                      />
                      <button
                        type="button"
                        aria-label="Remover linha"
                        onClick={() => setLinhas((ls) => ls.filter((_, i) => i !== idx))}
                        style={{
                          border: 0,
                          background: "none",
                          cursor: "pointer",
                          color: "var(--color-neutral-600)",
                        }}
                      >
                        <X size={16} strokeWidth={2.75} />
                      </button>
                    </div>

                    <select
                      value={String(l.match)}
                      onChange={(e) =>
                        setLinha(idx, {
                          match: e.target.value === "novo" ? "novo" : Number(e.target.value),
                        })
                      }
                      style={campo}
                    >
                      <option value="novo">➕ Criar novo ingrediente</option>
                      {ingredientes.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nome}
                        </option>
                      ))}
                    </select>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 1fr", gap: 8 }}>
                      <input
                        inputMode="decimal"
                        value={l.quantidade}
                        onChange={(e) => setLinha(idx, { quantidade: e.target.value })}
                        placeholder="Qtd"
                        style={campo}
                      />
                      <select
                        value={l.unidade}
                        onChange={(e) =>
                          setLinha(idx, { unidade: e.target.value as UnidadeMedida })
                        }
                        style={campo}
                      >
                        {UNIDADES.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                      <input
                        inputMode="decimal"
                        value={l.precoTotal}
                        onChange={(e) => setLinha(idx, { precoTotal: e.target.value })}
                        placeholder="€ total"
                        style={campo}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
                      {custoU > 0 ? `${formatEuro(custoU)} / ${l.unidade}` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {etapa === "rever" && (
          <div
            className="detalhe-actions"
            style={{ borderTop: "1px solid var(--color-divider)", paddingTop: 12 }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEtapa("captura")}
              style={{ flex: 1, height: 44 }}
            >
              Nova foto
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={confirmar}
              disabled={aGravar}
              style={{ flex: 1, height: 44 }}
            >
              {aGravar ? "A gravar…" : "Atualizar stock"}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

const campo: React.CSSProperties = {
  height: 40,
  borderRadius: 12,
  border: "1px solid var(--color-divider)",
  background: "var(--color-bg)",
  padding: "0 12px",
  fontSize: 14,
  color: "var(--color-text)",
  minWidth: 0,
};

const campoNome: React.CSSProperties = {
  ...campo,
  flex: 1,
  fontWeight: 600,
};
