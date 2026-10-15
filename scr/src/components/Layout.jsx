import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Zap,
  Activity,
  Cpu,
  TrendingUp,
  Users,
  FileText,
  Settings,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";
import Logo from "./Logo";
import TransmissionBackdrop from "./TransmissionBackdrop";
import { faturaReferencia } from "@/data/faturaReferencia";
import { billXray } from "@/lib/billXray";

// Valor evitável da fatura de referência (ultrapassagem + reativo)
const evitavelRef = billXray(faturaReferencia).evitavel;
import { useTheme } from "@/lib/theme";

const navItems = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Demanda", path: "/demanda", icon: Zap },
  { name: "Reativo", path: "/reativo", icon: Activity },
  { name: "Sensores", path: "/sensores", icon: Cpu },
  { name: "Simulação", path: "/mercado-livre", icon: TrendingUp },
  { name: "Fornecedores", path: "/prestadores", icon: Users },
  { name: "Documentos", path: "/documentos", icon: FileText },
  { name: "Configurações", path: "/configuracoes", icon: Settings },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
      className="relative inline-flex h-9 w-16 items-center rounded-full border border-slate-200 bg-slate-100 p-1 transition-colors cursor-pointer"
    >
      <span
        className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow-sm transition-transform duration-300 ${
          isDark ? "translate-x-7" : "translate-x-0"
        }`}
      />
      <Sun className={`relative z-10 ml-1.5 h-4 w-4 transition-colors ${isDark ? "text-slate-400" : "text-amber-500"}`} />
      <Moon className={`relative z-10 ml-auto mr-1.5 h-4 w-4 transition-colors ${isDark ? "text-sky-400" : "text-slate-400"}`} />
    </button>
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = navItems.find((item) => item.path === location.pathname);

  // Fecha o menu móvel ao trocar de página
  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      {/* Fundo escurecido do menu móvel */}
      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} />
      )}

      {/* Sidebar — sempre navy, como na identidade visual */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-hidden bg-navy-gradient text-white flex flex-col justify-between border-r border-white/5 transition-transform duration-300 lg:static lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brilho decorativo */}
        <div className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-brand-blue/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 -right-20 h-56 w-56 rounded-full bg-brand-green/10 blur-3xl" />

        <div className="relative flex flex-col min-h-0">
          <div className="px-6 pt-7 pb-6 flex items-start justify-between">
            <Link to="/dashboard" className="block">
              <Logo stacked markClassName="h-8" textClassName="text-2xl" />
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">
                Gestão Industrial
              </p>
            </Link>
            <button
              type="button"
              className="lg:hidden p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-glass/10"
              onClick={() => setMenuOpen(false)}
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mx-6 mb-4 h-px bg-gradient-to-r from-brand-blue/60 via-brand-cyan/30 to-transparent" />

          <nav className="px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-brand-blue/25 to-brand-cyan/5 text-white ring-1 ring-inset ring-brand-blue/40"
                      : "text-white/55 hover:bg-glass/5 hover:text-white"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-brand-gradient" />
                  )}
                  <Icon
                    className={`h-[18px] w-[18px] transition-colors ${
                      isActive ? "text-brand-cyan" : "text-white/40 group-hover:text-white/80"
                    }`}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Card de economia */}
        <div className="relative m-4 overflow-hidden rounded-2xl border border-brand-green/25 bg-glass/[0.04] p-4">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-green/60 to-transparent" />
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">Economia possível</p>
          <p className="mt-1 font-heading text-2xl font-bold text-gradient-brand">
            {evitavelRef.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
          </p>
          <p className="text-[11px] text-white/40">por mês, evitável sem obra (fatura de referência)</p>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <div className="relative isolate flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Fundo: degradê da marca + linha de transmissão bem transparente */}
        <div className="app-backdrop absolute inset-0 -z-10" aria-hidden="true" />
        <TransmissionBackdrop className="app-towers absolute inset-x-0 bottom-0 h-[58%] w-full -z-10" />

        <header className="h-16 bg-white/80 backdrop-blur border-b border-slate-200/70 flex items-center justify-between gap-4 px-4 sm:px-8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            {current && (
              <div className="flex items-center gap-2 min-w-0">
                <current.icon className="h-4 w-4 text-sky-500 shrink-0" />
                <span className="font-heading text-sm font-semibold text-slate-900 truncate">{current.name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <span className="relative mr-2 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Sistema Online
            </span>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-8">{children}</main>
      </div>
    </div>
  );
}
