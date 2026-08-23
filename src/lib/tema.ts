import { useSyncExternalStore } from "react";

/**
 * Temas de cor da app. As paletas vivem em styles.css como blocos
 * `:root[data-theme="…"]`; aqui só se aplica o atributo e se persiste a
 * escolha. Sem escolha guardada, respeita o modo escuro do sistema.
 */

export type Tema = "organic" | "meia-noite" | "morango";

export const TEMAS: { id: Tema; nome: string; descricao: string }[] = [
  { id: "organic", nome: "Organic", descricao: "Creme e terracota — o tema original" },
  { id: "meia-noite", nome: "Meia-noite", descricao: "Escuro e quente, para a madrugada" },
  { id: "morango", nome: "Morango", descricao: "Rosa pastelaria e hortelã" },
];

const TEMA_KEY = "chefgestao:tema";

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function ehTema(v: string | null): v is Tema {
  return v === "organic" || v === "meia-noite" || v === "morango";
}

function temaGuardado(): Tema | null {
  if (typeof localStorage === "undefined") return null;
  const v = localStorage.getItem(TEMA_KEY);
  return ehTema(v) ? v : null;
}

function temaDoSistema(): Tema {
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  ) {
    return "meia-noite";
  }
  return "organic";
}

export function temaAtual(): Tema {
  return temaGuardado() ?? temaDoSistema();
}

function aplicar(tema: Tema): void {
  const raiz = document.documentElement;
  raiz.dataset.theme = tema;
  // A variante `dark` do Tailwind/shadcn segue a classe .dark.
  raiz.classList.toggle("dark", tema === "meia-noite");
}

export function definirTema(tema: Tema): void {
  try {
    localStorage.setItem(TEMA_KEY, tema);
  } catch {
    /* ignore */
  }
  aplicar(tema);
  listeners.forEach((l) => l());
}

/** Chamar uma vez no arranque, antes do primeiro render. */
export function inicializarTema(): void {
  if (typeof document === "undefined") return;
  aplicar(temaAtual());
}

export function useTema(): Tema {
  return useSyncExternalStore(subscribe, temaAtual, () => "organic");
}
