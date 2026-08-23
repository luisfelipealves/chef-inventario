import type { Cliente, Pedido, Receita } from "@/lib/db";
import { formatEuro } from "@/lib/format";
import { dataEntregaLonga } from "@/lib/data-format";
import { emTauri } from "@/lib/backup";
import { nomeGuardado } from "@/lib/perfil";

/**
 * Documento PDF de um pedido, virado para o cliente final: orçamento
 * (antes de confirmar) ou resumo do pedido. Nunca inclui custos nem margens.
 * Sem valor fiscal — não é uma fatura.
 */

export type TipoDocumento = "orcamento" | "pedido";

const TITULO: Record<TipoDocumento, string> = {
  orcamento: "Orçamento",
  pedido: "Resumo do pedido",
};

/** As fontes standard do PDF são WinAnsi: troca espaços especiais do Intl. */
function txt(s: string): string {
  return s.replace(/[\u202F\u00A0]/g, " ");
}

function euro(v: number): string {
  return txt(formatEuro(v, { compact: true }));
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036F]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "cliente"
  );
}

const MARGEM = 18;
const LARGURA = 210;
const LIMITE_Y = 265;

export async function exportarPedidoPdf({
  tipo,
  pedido,
  cliente,
  receitaMap,
}: {
  tipo: TipoDocumento;
  pedido: Pedido;
  cliente?: Cliente;
  receitaMap: Map<number, Receita>;
}): Promise<string | null> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const direita = LARGURA - MARGEM;
  const hoje = new Date();
  const emitido = `${hoje.getDate()}/${hoje.getMonth() + 1}/${hoje.getFullYear()}`;
  let y = MARGEM + 4;

  function rodape() {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      txt(`Documento sem valor fiscal · Gerado com ChefGestão a ${emitido}`),
      LARGURA / 2,
      290,
      { align: "center" },
    );
    doc.setTextColor(0);
  }

  function novaPaginaSePreciso(alturaLinha: number) {
    if (y + alturaLinha <= LIMITE_Y) return;
    rodape();
    doc.addPage();
    y = MARGEM + 4;
  }

  // Cabeçalho: quem emite + tipo de documento
  const emissor = nomeGuardado() || "ChefGestão";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(txt(emissor), MARGEM, y);
  doc.setFontSize(20);
  doc.text(TITULO[tipo], direita, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(txt(`Nº ${pedido.id} · emitido a ${emitido}`), direita, y, { align: "right" });
  doc.setTextColor(0);
  y += 8;
  doc.setDrawColor(210);
  doc.line(MARGEM, y, direita, y);
  y += 9;

  // Cliente e entrega
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("PARA", MARGEM, y);
  doc.text("ENTREGA", direita - 60, y);
  doc.setTextColor(0);
  y += 5;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(txt(cliente?.nome ?? "Cliente"), MARGEM, y);
  doc.setFont("helvetica", "normal");
  doc.text(txt(dataEntregaLonga(pedido.dataEntrega)), direita - 60, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(90);
  const linhasCliente = [cliente?.telefone, cliente?.endereco, cliente?.nif && `NIF ${cliente.nif}`]
    .filter((v): v is string => Boolean(v))
    .map(txt);
  for (const l of linhasCliente) {
    doc.text(l, MARGEM, y);
    y += 4.5;
  }
  doc.setTextColor(0);
  y += 6;

  // Tabela de itens
  const COL_QTD = MARGEM;
  const COL_NOME = MARGEM + 16;
  const COL_UNIT = direita - 34;
  const COL_TOTAL = direita;
  const LARGURA_NOME = COL_UNIT - COL_NOME - 14;

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("QTD", COL_QTD, y);
  doc.text("RECEITA", COL_NOME, y);
  doc.text("PREÇO", COL_UNIT, y, { align: "right" });
  doc.text("TOTAL", COL_TOTAL, y, { align: "right" });
  doc.setTextColor(0);
  y += 2.5;
  doc.setDrawColor(210);
  doc.line(MARGEM, y, direita, y);
  y += 6;

  let total = 0;
  doc.setFontSize(10.5);
  for (const item of pedido.itens) {
    const nome = txt(receitaMap.get(item.receitaId)?.nome ?? "Receita removida");
    const linhas = doc.splitTextToSize(nome, LARGURA_NOME) as string[];
    const altura = Math.max(1, linhas.length) * 5 + 3;
    novaPaginaSePreciso(altura);

    const totalLinha = item.quantidade * item.precoUnitario;
    total += totalLinha;
    doc.text(`${item.quantidade}×`, COL_QTD, y);
    doc.text(linhas, COL_NOME, y);
    doc.text(euro(item.precoUnitario), COL_UNIT, y, { align: "right" });
    doc.text(euro(totalLinha), COL_TOTAL, y, { align: "right" });
    y += altura;
  }

  // Total
  novaPaginaSePreciso(14);
  doc.setDrawColor(150);
  doc.line(COL_UNIT - 30, y - 2, direita, y - 2);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(tipo === "orcamento" ? "Total estimado" : "Total", COL_UNIT - 30, y);
  doc.text(euro(total), COL_TOTAL, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 12;

  // Notas
  if (pedido.notas.trim()) {
    const linhas = doc.splitTextToSize(txt(pedido.notas.trim()), direita - MARGEM) as string[];
    novaPaginaSePreciso(linhas.length * 4.5 + 10);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("NOTAS", MARGEM, y);
    doc.setTextColor(90);
    y += 5;
    doc.text(linhas, MARGEM, y);
    doc.setTextColor(0);
  }

  rodape();

  const nomeFicheiro = `${tipo === "orcamento" ? "orcamento" : "pedido"}-${slug(
    cliente?.nome ?? "",
  )}-${pedido.id}.pdf`;
  const bytes = new Uint8Array(doc.output("arraybuffer"));

  if (emTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const caminho = await save({
      defaultPath: nomeFicheiro,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!caminho) return null;
    await writeFile(caminho, bytes);
    return nomeFicheiro;
  }

  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFicheiro;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return nomeFicheiro;
}
