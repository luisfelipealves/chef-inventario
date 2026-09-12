import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/**
 * Estado do shell desktop, partilhado entre a barra lateral/topo e as rotas.
 * Dados continuam a vir de `useLiveQuery`; isto guarda apenas estado de UI.
 */

export type ModuloLista = "pedidos" | "receitas" | "ingredientes" | "clientes";
export type SheetMode = "novo" | "editar" | "compra";

export interface SheetState {
  module: ModuloLista;
  mode: SheetMode;
  id?: number;
}

interface ShellValue {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;

  /** Navegação móvel; independente da sidebar persistente do desktop. */
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
  toggleMobileNav: () => void;
  closeMobileNav: () => void;

  /** Pesquisa global; limpa ao navegar. */
  query: string;
  setQuery: (v: string) => void;

  /** Linha seleccionada por módulo (sobrevive à navegação). */
  selection: Record<ModuloLista, number | null>;
  setSelection: (m: ModuloLista, id: number | null) => void;

  /** Filtro activo por módulo. */
  filtro: Record<ModuloLista, string>;
  setFiltro: (m: ModuloLista, v: string) => void;

  /** Painel lateral de formulário (novo/editar/compra). */
  sheet: SheetState | null;
  openSheet: (s: SheetState) => void;
  closeSheet: () => void;
}

const ShellContext = createContext<ShellValue | null>(null);

const SIDEBAR_KEY = "chefgestao:sidebar-open";

const FILTROS_INICIAIS: Record<ModuloLista, string> = {
  pedidos: "abertos",
  receitas: "todas",
  ingredientes: "todos",
  clientes: "todos",
};

export function ShellProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpenState] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return true;
    return localStorage.getItem(SIDEBAR_KEY) !== "false";
  });
  const setSidebarOpen = useCallback((v: boolean) => {
    setSidebarOpenState(v);
    try {
      localStorage.setItem(SIDEBAR_KEY, String(v));
    } catch {
      /* ignore */
    }
  }, []);
  const toggleSidebar = useCallback(
    () => setSidebarOpen(!sidebarOpen),
    [sidebarOpen, setSidebarOpen],
  );

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const toggleMobileNav = useCallback(() => setMobileNavOpen((open) => !open), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  const [query, setQuery] = useState("");

  const [selection, setSelectionState] = useState<Record<ModuloLista, number | null>>({
    pedidos: null,
    receitas: null,
    ingredientes: null,
    clientes: null,
  });
  const setSelection = useCallback((m: ModuloLista, id: number | null) => {
    setSelectionState((s) => ({ ...s, [m]: id }));
  }, []);

  const [filtro, setFiltroState] = useState(FILTROS_INICIAIS);
  const setFiltro = useCallback((m: ModuloLista, v: string) => {
    setFiltroState((s) => ({ ...s, [m]: v }));
  }, []);

  const [sheet, setSheet] = useState<SheetState | null>(null);
  const openSheet = useCallback((s: SheetState) => setSheet(s), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  return (
    <ShellContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
        mobileNavOpen,
        setMobileNavOpen,
        toggleMobileNav,
        closeMobileNav,
        query,
        setQuery,
        selection,
        setSelection,
        filtro,
        setFiltro,
        sheet,
        openSheet,
        closeSheet,
      }}
    >
      {children}
    </ShellContext.Provider>
  );
}

export function useShell(): ShellValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell tem de ser usado dentro de <ShellProvider>");
  return ctx;
}
