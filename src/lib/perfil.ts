import { useSyncExternalStore } from "react";

/**
 * Perfil local do utilizador (apenas o nome, por agora).
 * `null` = nunca perguntado (primeiro arranque); `""` = preferiu não dizer.
 */

const NOME_KEY = "chefgestao:nome-utilizador";

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
