import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Zap, 
  Activity, 
  Cpu, 
  TrendingUp, 
  Users, 
  FileText, 
  Settings 
} from "lucide-react";

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

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8fafc]">
      {/* Sidebar Escura */}
      <aside className="w-64 bg-[#111827] text-white flex flex-col justify-between shrink-0 h-full">
        <div className="flex flex-col h-full justify-between">
          <div>
            {/* Header da Sidebar */}
            <div className="p-6 flex items-center space-x-3">
              <div className="p-2 bg-sky-500 rounded-xl text-white">
                <Zap className="h-6 w-6 fill-current" />
              </div>
              <div>
                <h1 className="font-bold text-white text-lg leading-tight">EnergyIQ</h1>
                <p className="text-xs text-slate-400">Gestão Industrial</p>
              </div>
            </div>

            {/* Menu de Navegação */}
            <nav className="px-3 py-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-sky-500 text-white shadow-lg shadow-sky-500/30"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </div>
                    {isActive && <span className="text-xs">›</span>}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Card Inferior (Economia) */}
          <div className="p-4 m-4 bg-[#1e293b]/60 rounded-2xl border border-slate-800">
            <p className="text-xs text-slate-400">Economia estimada</p>
            <p className="text-xl font-bold text-sky-400 mt-0.5">R$ 12.450</p>
            <p className="text-[10px] text-slate-500">este mês</p>
          </div>
        </div>
      </aside>

      {/* Área de Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Navbar Superior */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-end px-8 shrink-0">
          <span className="inline-flex items-center text-xs text-slate-500 font-medium">
            <span className="w-2 h-2 mr-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Sistema Online
          </span>
        </header>

        {/* Conteúdo da Página */}
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}