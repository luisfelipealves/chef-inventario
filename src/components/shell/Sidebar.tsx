import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  Package,
  Users,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
  TriangleAlert,
  Settings,
  ShoppingBasket,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShell, type ModuloLista } from "@/lib/shell";
import type { AlertaStock } from "@/lib/stock-alerta";
import { DefinicoesSheet } from "@/components/DefinicoesSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface NavDef {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  module?: ModuloLista;
  exact?: boolean;
}

const NAV: NavDef[] = [
  { to: "/", labelKey: "nav.painel", icon: LayoutDashboard, exact: true },
  { to: "/pedidos", labelKey: "nav.pedidos", icon: ClipboardList, module: "pedidos" },
  { to: "/receitas", labelKey: "nav.receitas", icon: BookOpen, module: "receitas" },
  { to: "/pronto-venda", labelKey: "nav.prontoVenda", icon: ShoppingBasket },
  { to: "/ingredientes", labelKey: "nav.ingredientes", icon: Package, module: "ingredientes" },
  { to: "/clientes", labelKey: "nav.clientes", icon: Users, module: "clientes" },
  { to: "/financeiro", labelKey: "nav.financeiro", icon: Wallet },
];

export function Sidebar({
  counts,
  alertas,
  prontosCount,
}: {
  counts: Record<ModuloLista, number>;
  alertas: AlertaStock[];
  prontosCount: number;
}) {
  const { t } = useTranslation();
  const { sidebarOpen, toggleSidebar, setFiltro, mobileNavOpen, setMobileNavOpen, closeMobileNav } =
    useShell();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const collapsed = !isMobile && !sidebarOpen;
  const [definicoesOpen, setDefinicoesOpen] = useState(false);

  function verStockBaixo() {
    setFiltro("ingredientes", "stock-baixo");
    navigate({ to: "/ingredientes" });
  }

  const content: ReactNode = (
    <>
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark">C</span>
        {!collapsed && (
          <span>
            <span className="sidebar-brand-name" style={{ display: "block" }}>
              Caderninho
            </span>
            <span className="sidebar-brand-tag">de Receitas</span>
          </span>
        )}
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item) => {
          const Icon = item.icon;
          const count =
            item.to === "/pronto-venda"
              ? prontosCount
              : item.module
                ? counts[item.module]
                : undefined;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="nav-item"
              title={collapsed ? t(item.labelKey) : undefined}
              activeOptions={{ exact: item.exact ?? false }}
              activeProps={{ "data-active": "true" } as Record<string, string>}
              onClick={closeMobileNav}
            >
              <Icon size={19} strokeWidth={2.75} />
              {!collapsed && (
                <>
                  <span className="nav-item-label">{t(item.labelKey)}</span>
                  {count !== undefined && <span className="nav-item-count">{count}</span>}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && alertas.length > 0 && (
          <button
            type="button"
            className="sidebar-alert"
            onClick={() => {
              verStockBaixo();
              closeMobileNav();
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TriangleAlert size={17} strokeWidth={2.75} />
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: 13,
                  lineHeight: 1.1,
                }}
              >
                {t("nav.stockBaixo", { n: alertas.length })}
              </span>
            </span>
            <span
              style={{
                display: "block",
                marginTop: 4,
                fontSize: 11,
                opacity: 0.85,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {alertas.map((a) => a.ingrediente.nome).join(", ")}
            </span>
          </button>
        )}

        <button
          type="button"
          className="nav-item"
          title={collapsed ? t("nav.definicoes") : undefined}
          onClick={() => {
            closeMobileNav();
            setDefinicoesOpen(true);
          }}
        >
          <Settings size={19} strokeWidth={2.75} />
          {!collapsed && <span className="nav-item-label">{t("nav.definicoes")}</span>}
        </button>

        {!isMobile && (
          <button type="button" className="nav-item" onClick={toggleSidebar}>
            {collapsed ? (
              <PanelLeftOpen size={19} strokeWidth={2.75} />
            ) : (
              <PanelLeftClose size={19} strokeWidth={2.75} />
            )}
            {!collapsed && <span className="nav-item-label">{t("nav.recolher")}</span>}
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {isMobile ? (
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="sidebar sidebar-mobile" aria-describedby={undefined}>
            <SheetHeader className="sr-only">
              <SheetTitle>{t("nav.menu")}</SheetTitle>
            </SheetHeader>
            {content}
          </SheetContent>
        </Sheet>
      ) : (
        <aside className="sidebar" data-collapsed={collapsed}>
          {content}
        </aside>
      )}
      <DefinicoesSheet open={definicoesOpen} onOpenChange={setDefinicoesOpen} />
    </>
  );
}
