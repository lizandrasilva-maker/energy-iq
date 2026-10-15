import { useState } from "react";
import { Sparkles, Plus } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import {
  useChartTheme, AreaGradient, ChartTooltip, ChartLegend, axisProps, gridProps, lineCursor, barCursor, activeDot, formatMonth,
} from "../components/charts/ChartKit";

import BillAnalyzer from "../components/BillAnalyzer";
import { parseNumberBR } from "../lib/billParsing";
import { faturaReferencia as ref } from "../data/faturaReferencia";
import DemandContractSimulator from "../components/DemandContractSimulator";

// Histórico real (13 meses) da fatura de referência, anonimizada
const refHistory = ref.historico.map((h) => ({
  month: h.mes,
  demand: h.demandaForaPontaKw,
  demandPonta: h.demandaPontaKw,
  consumoForaPonta: h.consumoForaPontaKwh,
  consumoPonta: h.consumoPontaKwh,
}));
const tarifaDemanda = ref.itens.find((i) => i.componente === "demanda").precoComTributos;

export default function DemandMonitoring() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [demandContracted, setDemandContracted] = useState(ref.demandaContratadaKw);
  const [demandActive, setDemandActive] = useState(ref.medicao.demandaForaPontaKw);
  const [chartData] = useState(refHistory);

  const maxDemand = chartData && chartData.length > 0 
    ? Math.max(...chartData.map((item) => Number(item.demand) || 0)) 
    : 940;

  // Ultrapassagem: demanda medida acima de 105% da contratada (tolerância de 5%, REN ANEEL 1.000/2021)
  const surpassLimit = demandContracted * 1.05;
  const exceededCount = chartData && chartData.length > 0
    ? chartData.filter((item) => (item.demand || 0) > surpassLimit).length
    : 0;
  const chart = useChartTheme();

  const handleAnalysisComplete = (data) => {
    if (data) {
      const measured = parseNumberBR(data.demand_measured);
      const contracted = parseNumberBR(data.demand_contracted);
      if (measured) setDemandActive(measured);
      if (contracted) setDemandContracted(contracted);
    }
  };

  return (
    <div className="lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monitoramento de Demanda</h1>
          <p className="text-sm text-slate-500">Acompanhe o consumo mensal vs demanda contratada</p>
        </div>
        <div className="flex space-x-3">
          <button 
            type="button"
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-medium flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Nova Leitura</span>
          </button>
          <button 
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-medium flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
          >
            <Sparkles className="h-4 w-4 text-sky-600" />
            <span>Anexar Fatura</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 bg-sky-50/40 rounded-2xl border border-sky-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Demanda Contratada</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {Number(demandContracted).toLocaleString("pt-BR")} <span className="text-sm font-normal text-slate-500">kW</span>
            </p>
          </div>
          <div className="p-2.5 bg-sky-100/60 text-sky-600 rounded-xl">⚡</div>
        </div>

        <div className="p-5 bg-rose-50/30 rounded-2xl border border-rose-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Demanda Medida (Fatura)</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {Number(demandActive).toLocaleString("pt-BR")} <span className="text-sm font-normal text-slate-500">kW</span>
            </p>
          </div>
          <div className="p-2.5 bg-rose-100/50 text-rose-500 rounded-xl">📈</div>
        </div>

        <div className="p-5 bg-rose-50/30 rounded-2xl border border-rose-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Demanda Máxima</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {(!isNaN(maxDemand) && maxDemand > 0 ? maxDemand : 0).toLocaleString("pt-BR")} <span className="text-sm font-normal text-slate-500">kW</span>
            </p>
          </div>
          <div className="p-2.5 bg-rose-100/50 text-rose-500 rounded-xl">📈</div>
        </div>

        <div className="p-5 bg-amber-50/30 rounded-2xl border border-amber-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500" title="Demanda medida acima de 105% da contratada">Meses com Ultrapassagem</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {exceededCount} <span className="text-sm font-normal text-slate-500">de {chartData.length}</span>
            </p>
          </div>
          <div className="p-2.5 bg-amber-100/50 text-amber-600 rounded-xl">⚠️</div>
        </div>
      </div>

      <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Demanda Mensal</h2>
        <p className="text-xs text-slate-500 mb-6">Demanda medida fora de ponta vs contratada · fatura real anonimizada (13 meses)</p>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid {...gridProps(chart)} />
              <XAxis dataKey="month" tickFormatter={formatMonth} {...axisProps(chart)} />
              <YAxis {...axisProps(chart)} width={44} />
              <Tooltip
                cursor={barCursor(chart)}
                content={
                  <ChartTooltip
                    labelFormat={formatMonth}
                    format={(v) => `${Number(v).toLocaleString("pt-BR")} kW`}
                    extra={(d) =>
                      d.demand > surpassLimit
                        ? `Ultrapassagem: ${(d.demand - demandContracted).toLocaleString("pt-BR")} kW acima da contratada`
                        : "Dentro da tolerância de 5%"
                    }
                  />
                }
              />
              <ReferenceLine
                y={demandContracted}
                stroke={chart.reference}
                strokeDasharray="5 5"
              />
              <Bar dataKey="demand" name="Demanda medida" radius={[4, 4, 0, 0]}>
                {chartData.map((d) => (
                  <Cell key={d.month} fill={d.demand > surpassLimit ? chart.critical : chart.series[0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ChartLegend
          items={[
            { label: "Demanda medida", color: chart.series[0], kind: "bar" },
            { label: "Ultrapassagem (acima de 105%)", color: chart.critical, kind: "bar" },
            { label: `Contratada (${demandContracted.toLocaleString("pt-BR")} kW)`, color: chart.reference, kind: "dashed" },
          ]}
        />
      </div>

      <DemandContractSimulator historico={ref.historico} contratoAtualKw={demandContracted} tarifaKw={tarifaDemanda} />

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Histórico de faturamento</h2>
          <p className="text-xs text-slate-500">Como impresso na fatura de referência. Ultrapassagem = demanda medida acima de 105% da contratada.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 min-w-[640px]">
            <thead className="bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">Mês</th>
                <th className="px-6 py-3.5 text-right">Demanda fora ponta (kW)</th>
                <th className="px-6 py-3.5 text-right">Demanda ponta (kW)</th>
                <th className="px-6 py-3.5 text-right">Consumo fora ponta (kWh)</th>
                <th className="px-6 py-3.5 text-right">Consumo ponta (kWh)</th>
                <th className="px-6 py-3.5 text-center">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...chartData].reverse().map((row) => {
                const over = row.demand > surpassLimit;
                return (
                  <tr key={row.month} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-900">{formatMonth(row.month)}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{row.demand.toLocaleString("pt-BR")}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{row.demandPonta?.toLocaleString("pt-BR") ?? "—"}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{row.consumoForaPonta?.toLocaleString("pt-BR") ?? "—"}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{row.consumoPonta?.toLocaleString("pt-BR") ?? "—"}</td>
                    <td className="px-6 py-3.5 text-center">
                      {over ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-100">
                          ⚠️ Ultrapassagem +{(row.demand - demandContracted).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kW
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                          ✔ Dentro do contrato
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <BillAnalyzer 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAnalysisComplete={handleAnalysisComplete} 
      />
    </div>
  );
}