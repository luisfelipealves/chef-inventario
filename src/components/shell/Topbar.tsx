import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useTranslation, type UseTranslationResponse } from "react-i18next";
import { Plus } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { useShell, type ModuloLista } from "@/lib/shell";
import { useNomeUtilizador } from "@/lib/perfil";
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

type T = UseTranslationResponse<"translation", undefined>["t"];

const ROTA_POR_MODULO = {
  pedidos: "/pedidos",
  receitas: "/receitas",
  ingredientes: "/ingredientes",
  clientes: "/clientes",
} as const;

function saudacao(hora: number, t: T): string {
  if (hora < 12) return t("topbar.bomDia");
  if (hora < 20) return t("topbar.boaTarde");
  return t("topbar.boaNoite");
}

function configPara(pathname: string, nome: string, t: T): RotaConfig {
  switch (pathname) {
    case "/pedidos":
      return {
        titulo: t("nav.pedidos"),
        primario: { label: t("topbar.novoPedido"), module: "pedidos" },
      };
    case "/receitas":
      return {
        titulo: t("nav.receitas"),
        primario: { label: t("topbar.novaReceita"), module: "receitas" },
      };
    case "/ingredientes":
      return {
        titulo: t("nav.ingredientes"),
        primario: { label: t("topbar.novoIngrediente"), module: "ingredientes" },
      };
    case "/clientes":
      return {
        titulo: t("nav.clientes"),
        primario: { label: t("topbar.novoCliente"), module: "clientes" },
      };
    case "/financeiro":
      return {
        titulo: t("nav.financeiro"),
        primario: { label: t("topbar.novoPedido"), module: "pedidos" },
      };
    default: {
      const base = saudacao(new Date().getHours(), t);
      return {
        titulo: nome ? `${base}, ${nome}` : base,
        primario: { label: t("topbar.novoPedido"), module: "pedidos" },
      };
    }
  }
}

export function Topbar({ datasets }: { datasets: Datasets }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { openSheet } = useShell();
  const searchRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  const nome = useNomeUtilizador();
  const { titulo, primario } = configPara(pathname, nome ?? "", t);

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
        onClick={() => {
          // A sheet só é consumida pela rota do próprio módulo; garante que estamos lá.
          if (pathname !== ROTA_POR_MODULO[primario.module]) {
            navigate({ to: ROTA_POR_MODULO[primario.module] });
          }
          openSheet({ module: primario.module, mode: "novo" });
        }}
      >
        <Plus size={17} strokeWidth={2.75} />
        {primario.label}
      </button>
    </header>
  );
}
