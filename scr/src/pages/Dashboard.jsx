import { useState } from "react";
import { Gauge, Zap, Activity, Info, X, FileText, BadgeCheck } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  useChartTheme, AreaGradient, ChartTooltip, ChartLegend, axisProps, gridProps, lineCursor, barCursor, activeDot, formatMonth,
} from "../components/charts/ChartKit";
import KpiCard from "../components/charts/KpiCard";
import BillAnalyzer from "../components/BillAnalyzer";
import { updateIndustryDataFromBill } from "../api/base44Client";
import { parseNumberBR, normalizeMonth } from "../lib/billParsing";
import { faturaReferencia as ref } from "../data/faturaReferencia";
import { billXray, simularContratoDemanda } from "../lib/billXray";
import BillXrayCard from "../components/BillXrayCard";

// Base: fatura real (anonimizada) de indústria A4 Verde da Enel CE, 08/2024
const refXray = billXray(ref);
const refItem = (k) => ref.itens.filter((i) => i.componente === k).reduce((t, i) => t + i.valor, 0);
const refSim = simularContratoDemanda(
  ref.historico,
  ref.demandaContratadaKw,
  ref.itens.find((i) => i.componente === "demanda").precoComTributos
);

const initialDashboardData = {
  contractedDemand: ref.demandaContratadaKw,
  activeDemand: ref.medicao.demandaForaPontaKw,
  monthlyConsumption: ref.medicao.energiaForaPontaKwh + ref.medicao.energiaPontaKwh,
  reactiveCost: refItem("reativo"),
  companyName: `${ref.cliente} · ${ref.subgrupo} ${ref.modalidade} · ${ref.distribuidora} · fatura ${ref.referencia.split("-").reverse().join("/")}`,
  isReference: true,
  alertTitle: "Ultrapassagem de demanda em todos os 13 meses do histórico",
  alertMessage:
    `Contrato de ${ref.demandaContratadaKw} kW para uma demanda medida entre ${Math.min(...ref.historico.map((h) => h.demandaForaPontaKw)).toLocaleString("pt-BR")} e ` +
    `${Math.max(...ref.historico.map((h) => h.demandaForaPontaKw)).toLocaleString("pt-BR")} kW. Só neste mês a multa de ultrapassagem foi de ` +
    `${refItem("ultrapassagem").toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. ` +
    `Contratar ${refSim.otimo.contratoKw} kW reduziria o custo de demanda em ` +
    `${refSim.economia.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} nos ${refSim.meses} meses.`,
};

const initialChartHistory = ref.historico.map((h) => ({
  month: h.mes,
  contratada: ref.demandaContratadaKw,
  medida: h.demandaForaPontaKw,
  consumo: h.consumoForaPontaKwh + h.consumoPontaKwh,
  consumoForaPonta: h.consumoForaPontaKwh,
  consumoPonta: h.consumoPontaKwh,
}));

const HISTORY_MONTHS = 13;

export default function Dashboard() {
  const [showAlert, setShowAlert] = useState(true);
  const [isAnalyzerOpen, setIsAnalyzerOpen] = useState(false);
  
  const [metrics, setMetrics] = useState(initialDashboardData);
  const [history, setHistory] = useState(initialChartHistory);
  const chart = useChartTheme();

  /** Variação % do último mês do histórico em relação ao anterior. */
  const monthDelta = (key) => {
    if (history.length < 2) return null;
    const prev = history[history.length - 2][key], last = history[history.length - 1][key];
    return prev ? ((last - prev) / prev) * 100 : null;
  };

  const handleAnalysisComplete = (newBillData) => {
    if (!newBillData) return;

    // 1. Atualiza a camada base44 de dados
    updateIndustryDataFromBill(newBillData);

    // 2. Valores da fatura (aceita número ou texto no formato brasileiro).
    // O prompt pede consumo em kWh: o valor é usado como veio.
    const contracted = parseNumberBR(newBillData.demand_contracted, metrics.contractedDemand);
    const measured = parseNumberBR(newBillData.demand_measured, metrics.activeDemand);
    const consumptionInKWh = parseNumberBR(newBillData.consumption_total, metrics.monthlyConsumption);
    const suggested = parseNumberBR(newBillData.suggested_demand, null);
    // Mês no formato do histórico (AAAA-MM); sem mês legível, usa o mês atual
    const refMonth = normalizeMonth(newBillData.reference_month) || new Date().toISOString().slice(0, 7);

    // 3. Força a atualização do estado dos Cards de KPI
    setMetrics({
      contractedDemand: contracted,
      activeDemand: measured,
      monthlyConsumption: consumptionInKWh,
      reactiveCost: null,
      companyName: newBillData.client_name || metrics.companyName,
      isReference: false,
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
        consumo: consumptionInKWh,
        consumoForaPonta: consumptionInKWh,
        consumoPonta: 0,
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
          <p className="text-sm text-slate-500 font-medium flex flex-wrap items-center gap-2">
            {metrics.companyName}
            {metrics.isReference && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200" title="Números de uma fatura real de indústria, sem dados que identifiquem a empresa (LGPD)">
                <BadgeCheck className="h-3.5 w-3.5" /> fatura real anonimizada
              </span>
            )}
          </p>
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
        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Demanda Contratada"
          value={metrics.contractedDemand.toLocaleString("pt-BR")}
          unit="kW"
          icon={Gauge}
          note="Limite do contrato com a distribuidora"
        />
        <KpiCard
          label="Demanda Medida (Fatura)"
          value={metrics.activeDemand.toLocaleString("pt-BR")}
          unit="kW"
          icon={Gauge}
          spark={history}
          sparkKey="medida"
          sparkColor={chart.series[0]}
          delta={monthDelta("medida")}
        />
        <KpiCard
          label="Consumo (Fatura)"
          value={metrics.monthlyConsumption.toLocaleString("pt-BR")}
          unit="kWh"
          icon={Zap}
          spark={history}
          sparkKey="consumo"
          sparkColor={chart.series[1]}
          delta={monthDelta("consumo")}
        />
        <KpiCard
          label="Reativo Excedente"
          value={
            metrics.reactiveCost != null
              ? metrics.reactiveCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "não informado"
          }
          icon={Activity}
          note={
            metrics.reactiveCost != null
              ? "Cobrado por fator de potência abaixo de 0,92 (avaliado hora a hora). Some com correção do FP."
              : "A leitura da fatura ainda não separa o reativo."
          }
        />
      </div>

      {/* Raio-x da fatura */}
      <BillXrayCard fatura={ref} />

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900">Demanda Mensal</h2>
            <p className="text-xs text-slate-500">Demanda medida fora de ponta vs contratada (kW)</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <AreaGradient id="dash-demanda" color={chart.series[0]} />
                </defs>
                <CartesianGrid {...gridProps(chart)} />
                <XAxis dataKey="month" tickFormatter={formatMonth} {...axisProps(chart)} />
                <YAxis {...axisProps(chart)} width={44} />
                <Tooltip
                  cursor={lineCursor(chart)}
                  content={<ChartTooltip labelFormat={formatMonth} format={(v) => `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kW`} />}
                />
                <Area
                  type="monotone"
                  dataKey="medida"
                  name="Demanda medida"
                  stroke={chart.series[0]}
                  strokeWidth={2}
                  fill="url(#dash-demanda)"
                  activeDot={activeDot(chart, chart.series[0])}
                />
                <Area
                  type="stepAfter"
                  dataKey="contratada"
                  name="Contratada"
                  stroke={chart.reference}
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  fill="transparent"
                  activeDot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend
            items={[
              { label: "Demanda medida", color: chart.series[0], kind: "line" },
              { label: "Contratada", color: chart.reference, kind: "dashed" },
            ]}
          />
        </div>

        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900">Consumo de Energia</h2>
            <p className="text-xs text-slate-500">Total mensal por posto tarifário (kWh)</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid {...gridProps(chart)} />
                <XAxis dataKey="month" tickFormatter={formatMonth} {...axisProps(chart)} />
                <YAxis {...axisProps(chart)} width={68} tickFormatter={(v) => v.toLocaleString("pt-BR")} />
                <Tooltip
                  cursor={barCursor(chart)}
                  content={<ChartTooltip labelFormat={formatMonth} format={(v) => `${Number(v).toLocaleString("pt-BR")} kWh`} extra={(d) => `Total: ${d.consumo.toLocaleString("pt-BR")} kWh`} />}
                />
                <Bar dataKey="consumoForaPonta" name="Fora de ponta" stackId="c" fill={chart.series[0]} />
                <Bar dataKey="consumoPonta" name="Ponta" stackId="c" fill={chart.series[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend
            items={[
              { label: "Fora de ponta", color: chart.series[0], kind: "bar" },
              { label: "Ponta (17h30–20h30)", color: chart.series[1], kind: "bar" },
            ]}
          />
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