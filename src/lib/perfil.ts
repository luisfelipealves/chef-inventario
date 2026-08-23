import { useSyncExternalStore } from "react";

/**
 * Perfil local do utilizador: nome, nome do negócio e logótipo (para o
 * cabeçalho dos PDFs). Tudo em localStorage — nada sai do dispositivo.
 * Para o nome: `null` = nunca perguntado (primeiro arranque); `""` = preferiu
 * não dizer.
 */

const NOME_KEY = "chefgestao:nome-utilizador";
const NEGOCIO_KEY = "chefgestao:nome-negocio";
const LOGO_KEY = "chefgestao:logo-negocio";

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function lerNome(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(NOME_KEY);
}

export function gravarNome(nome: string): void {
  try {
    localStorage.setItem(NOME_KEY, nome.trim());
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useNomeUtilizador(): string | null {
  return useSyncExternalStore(subscribe, lerNome, () => null);
}

/** Leitura pontual (fora de componentes React), ex.: cabeçalho do PDF. */
export function nomeGuardado(): string {
  return lerNome() ?? "";
}

function lerChave(chave: string): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(chave) ?? "";
}

function gravarChave(chave: string, valor: string): boolean {
  try {
    if (valor) localStorage.setItem(chave, valor);
    else localStorage.removeItem(chave);
    listeners.forEach((l) => l());
    return true;
  } catch {
    return false;
  }
}

export function nomeNegocioGuardado(): string {
  return lerChave(NEGOCIO_KEY);
}

export function gravarNomeNegocio(nome: string): void {
  gravarChave(NEGOCIO_KEY, nome.trim());
}

export function useNomeNegocio(): string {
  return useSyncExternalStore(subscribe, nomeNegocioGuardado, () => "");
}

/** Data URL PNG do logótipo, ou "" se não configurado. */
export function logoNegocioGuardado(): string {
  return lerChave(LOGO_KEY);
}

/** Devolve false se não couber no localStorage (imagem demasiado grande). */
export function gravarLogoNegocio(dataUrl: string): boolean {
  return gravarChave(LOGO_KEY, dataUrl);
}

export function useLogoNegocio(): string {
  return useSyncExternalStore(subscribe, logoNegocioGuardado, () => "");
}

/**
 * Lê um ficheiro de imagem e devolve um data URL PNG redimensionado
 * (máx. 512 px no lado maior) — pequeno o suficiente para o localStorage
 * e nítido o suficiente para o cabeçalho de um PDF.
 */
export function carregarLogoDeFicheiro(ficheiro: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(ficheiro);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 512;
      const escala = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * escala);
      canvas.height = Math.round(img.naturalHeight * escala);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas indisponível"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Imagem ilegível"));
    };
    img.src = url;
  });
}
