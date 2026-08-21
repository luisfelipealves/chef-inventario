import { useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { useShell, type ModuloLista } from "@/lib/shell";
import type { Cliente, Ingrediente, Pedido, Receita } from "@/lib/db";

interface Datasets {
  ingredientes: Ingrediente[];
  receitas: Receita[];
  clientes: Cliente[];
  pedidos: Pedido[];
  clienteMap: Map<number, Cliente>;
  receitaMap: Map<number, Receita>;
  ingMap: Map<number, Ingrediente>;
}

interface RotaConfig {
  titulo: string;
  primario: { label: string; module: ModuloLista };
}

function saudacao(hora: number): string {
  if (hora < 12) return "Bom dia";
  if (hora < 20) return "Boa tarde";
  return "Boa noite";
}

function configPara(pathname: string): RotaConfig {
  switch (pathname) {
    case "/pedidos":
      return { titulo: "Pedidos", primario: { label: "Novo pedido", module: "pedidos" } };
    case "/receitas":
      return { titulo: "Receitas", primario: { label: "Nova receita", module: "receitas" } };
    case "/ingredientes":
      return {
        titulo: "Ingredientes",
        primario: { label: "Novo ingrediente", module: "ingredientes" },
      };
    case "/clientes":
      return { titulo: "Clientes", primario: { label: "Novo cliente", module: "clientes" } };
    default:
      return {
        titulo: saudacao(new Date().getHours()),
        primario: { label: "Novo pedido", module: "pedidos" },
      };
  }
}

export function Topbar({ datasets }: { datasets: Datasets }) {
  const { pathname } = useLocation();
  const { openSheet } = useShell();
  const searchRef = useRef<HTMLInputElement>(null);
  const { titulo, primario } = configPara(pathname);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="topbar">
      <h1 className="topbar-title">{titulo}</h1>
      <GlobalSearch ref={searchRef} datasets={datasets} />
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => openSheet({ module: primario.module, mode: "novo" })}
      >
        <Plus size={17} strokeWidth={2.75} />
        {primario.label}
      </button>
    </header>
  );
}
