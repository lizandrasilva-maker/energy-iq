import { useState } from "react";
import { Gauge, Zap, Activity, Info, X, FileText } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import BillAnalyzer from "../components/BillAnalyzer";
import { updateIndustryDataFromBill } from "../api/base44Client";
import { parseNumberBR, normalizeMonth } from "../lib/billParsing";

const initialDashboardData = {
  contractedDemand: 190,
  activeDemand: 225.46,
  monthlyConsumption: 20450,
  powerFactor: 0.92,
  companyName: "COMPACTO PRÉ MOLDE IND CERAMICA LTDA",
  alertTitle: "Ultrapassagem de Demanda Detectada",
  alertMessage: "A demanda medida (225,46 kW) ultrapassou a demanda contratada de 190,00 kW em 35,46 kW no mês de 01/2026. Recomendação: readequar para 230 kW.",
};

const initialChartHistory = [
  { month: "2025-08", contratada: 190, medida: 185, consumo: 19500 },
  { month: "2025-09", contratada: 190, medida: 188, consumo: 20100 },
  { month: "2025-10", contratada: 190, medida: 192, consumo: 21000 },
  { month: "2025-11", contratada: 190, medida: 210, consumo: 22000 },
  { month: "2025-12", contratada: 190, medida: 228.97, consumo: 23500 },
  { month: "2026-01", contratada: 190, medida: 225.46, consumo: 20450 },
];

const HISTORY_MONTHS = 6;

export default function Dashboard() {
  const [showAlert, setShowAlert] = useState(true);
  const [isAnalyzerOpen, setIsAnalyzerOpen] = useState(false);
  
  const [metrics, setMetrics] = useState(initialDashboardData);
  const [history, setHistory] = useState(initialChartHistory);

  const handleAnalysisComplete = (newBillData) => {
    if (!newBillData) return;

    // 1. Atualiza a camada base44 de dados
    updateIndustryDataFromBill(newBillData);

    // 2. Valores da fatura (aceita número ou texto no formato brasileiro).
    // O prompt pede consumo em kWh: o valor é usado como veio.
    const contracted = parseNumberBR(newBillData.demand_contracted, metrics.contractedDemand);
    const measured = parseNumberBR(newBillData.demand_measured, metrics.activeDemand);
    const consumptionInKWh = parseNumberBR(newBillData.consumption_total, metrics.monthlyConsumption);
    const pf = parseNumberBR(newBillData.power_factor, metrics.powerFactor);
    const suggested = parseNumberBR(newBillData.suggested_demand, null);
    // Mês no formato do histórico (AAAA-MM); sem mês legível, usa o mês atual
    const refMonth = normalizeMonth(newBillData.reference_month) || new Date().toISOString().slice(0, 7);

    // 3. Força a atualização do estado dos Cards de KPI
    setMetrics({
      contractedDemand: contracted,
      activeDemand: measured,
      monthlyConsumption: consumptionInKWh,
      powerFactor: pf,
      companyName: newBillData.client_name || metrics.companyName,
      alertTitle: measured > contracted 
        ? "Ultrapassagem de Demanda Detectada" 
        : "Fatura Processada com Sucesso",
      alertMessage: measured > contracted
        ? `A demanda medida (${measured.toLocaleString("pt-BR")} kW) superou a contratada (${contracted.toLocaleString("pt-BR")} kW).` +
          (suggested ? ` Sugestão de readequação: ${suggested.toLocaleString("pt-BR")} kW.` : "")
        : `Unidade Consumidora ${newBillData.uc || ''} analisada com sucesso.`
    });

    setShowAlert(true);

    // 4. Atualiza os gráficos (Recharts)
    setHistory((prevHistory) => {
      const newEntry = {
        month: refMonth,
        contratada: contracted,
        medida: measured,
        consumo: consumptionInKWh
      };

      // Substitui o mês se já existir; senão insere. Mantém ordem cronológica
      // e só os últimos HISTORY_MONTHS meses.
      const others = prevHistory.filter((item) => item.month !== refMonth);
      return [...others, newEntry]
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-HISTORY_MONTHS);
    });
  };

  return (
    <div className="lg:p-6 space-y-6">
      {/* Título e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Painel de Gestão Energética</h1>
          <p className="text-sm text-slate-500 font-medium">{metrics.companyName}</p>
        </div>

        <button
          onClick={() => setIsAnalyzerOpen(true)}
          className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer self-start sm:self-auto"
        >
          <FileText className="h-4 w-4" />
          <span>Analisar Nova Fatura</span>
        </button>
      </div>

      {/* Alerta Dinâmico */}
      {showAlert && (
        <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-200 rounded-xl text-slate-700">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{metrics.alertTitle}</p>
              <p className="text-xs text-slate-600">{metrics.alertMessage}</p>
            </div>
          </div>
          <button 
            onClick={() => setShowAlert(false)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Cards de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Demanda Contratada</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {metrics.contractedDemand.toLocaleString("pt-BR")} <span className="text-sm font-normal text-slate-500">kW</span>
            </p>
          </div>
          <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
            <Gauge className="h-5 w-5" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Demanda Ativa (Fatura)</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {metrics.activeDemand.toLocaleString("pt-BR")} <span className="text-sm font-normal text-slate-500">kW</span>
            </p>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <Gauge className="h-5 w-5" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Consumo (Fatura)</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {metrics.monthlyConsumption.toLocaleString("pt-BR")} <span className="text-sm font-normal text-slate-500">kWh</span>
            </p>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Zap className="h-5 w-5" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Fator de Potência</p>
            <p className={`text-2xl font-bold mt-1 ${metrics.powerFactor < 0.92 ? "text-amber-600" : "text-emerald-600"}`}>{metrics.powerFactor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Activity className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="mb-6">
            <h2 className="text-base font-bold text-slate-900">Demanda Mensal</h2>
            <p className="text-xs text-slate-500">Consumida vs Contratada (kW)</p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', borderColor: '#e2e8f0' }} />
                <Area type="monotone" dataKey="medida" name="Demanda Medida" stroke="#1a8cff" fill="#1a8cff" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="contratada" name="Contratada" stroke="#f59e0b" fill="transparent" strokeWidth={2} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="mb-6">
            <h2 className="text-base font-bold text-slate-900">Consumo de Energia</h2>
            <p className="text-xs text-slate-500">Total mensal (kWh)</p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', borderColor: '#e2e8f0' }} />
                <Bar dataKey="consumo" name="Consumo (kWh)" fill="#1a8cff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <BillAnalyzer 
        isOpen={isAnalyzerOpen} 
        onClose={() => setIsAnalyzerOpen(false)} 
        onAnalysisComplete={handleAnalysisComplete} 
      />
    </div>
  );
}