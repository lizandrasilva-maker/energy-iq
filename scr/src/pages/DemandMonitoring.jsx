import { useState } from "react";
import { Sparkles, Plus } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import {
  useChartTheme, AreaGradient, ChartTooltip, ChartLegend, axisProps, gridProps, lineCursor, barCursor, activeDot, formatMonth,
} from "../components/charts/ChartKit";

import BillAnalyzer from "../components/BillAnalyzer";
import { parseNumberBR } from "../lib/billParsing";

const defaultHistory = [
  { month: "2024-08", demand: 700 },
  { month: "2025-09", demand: 780 },
  { month: "2025-10", demand: 820 },
  { month: "2025-11", demand: 880 },
  { month: "2025-12", demand: 920 },
  { month: "2026-01", demand: 890 },
  { month: "2026-02", demand: 940 },
  { month: "2026-03", demand: 860 },
  { month: "2026-04", demand: 895 },
  { month: "2026-05", demand: 910 },
  { month: "2026-06", demand: 875 },
  { month: "2026-07", demand: 830 },
  { month: "2026-08", demand: 905 },
];

const readHistoryData = [
  { month: "2026-08", demand: 905, consumption: "467.000", cost: "R$ 468.000", fp: 0.84, status: "Excedida" },
  { month: "2026-07", demand: 830, consumption: "432.000", cost: "R$ 438.000", fp: 0.86, status: "OK" },
  { month: "2026-06", demand: 875, consumption: "453.000", cost: "R$ 456.000", fp: 0.85, status: "Excedida" },
  { month: "2026-05", demand: 910, consumption: "470.000", cost: "R$ 472.000", fp: 0.83, status: "Excedida" },
  { month: "2026-04", demand: 895, consumption: "461.000", cost: "R$ 463.000", fp: 0.84, status: "Excedida" },
  { month: "2026-03", demand: 860, consumption: "445.000", cost: "R$ 448.000", fp: 0.85, status: "Excedida" },
  { month: "2026-02", demand: 940, consumption: "481.000", cost: "R$ 482.000", fp: 0.81, status: "Excedida" },
  { month: "2026-01", demand: 890, consumption: "468.000", cost: "R$ 469.000", fp: 0.83, status: "Excedida" },
  { month: "2025-12", demand: 920, consumption: "472.000", cost: "R$ 476.000", fp: 0.82, status: "Excedida" },
  { month: "2025-11", demand: 870, consumption: "455.000", cost: "R$ 451.000", fp: 0.84, status: "Excedida" },
  { month: "2025-10", demand: 820, consumption: "438.000", cost: "R$ 432.000", fp: 0.86, status: "OK" },
];

export default function DemandMonitoring() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [demandContracted, setDemandContracted] = useState(850);
  const [demandActive, setDemandActive] = useState(905);
  const [chartData] = useState(defaultHistory);

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
              {demandContracted} <span className="text-sm font-normal text-slate-500">kW</span>
            </p>
          </div>
          <div className="p-2.5 bg-sky-100/60 text-sky-600 rounded-xl">⚡</div>
        </div>

        <div className="p-5 bg-rose-50/30 rounded-2xl border border-rose-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Demanda Ativa (Fatura)</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {demandActive} <span className="text-sm font-normal text-slate-500">kW</span>
            </p>
          </div>
          <div className="p-2.5 bg-rose-100/50 text-rose-500 rounded-xl">📈</div>
        </div>

        <div className="p-5 bg-rose-50/30 rounded-2xl border border-rose-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Demanda Máxima</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {!isNaN(maxDemand) && maxDemand > 0 ? maxDemand : 940} <span className="text-sm font-normal text-slate-500">kW</span>
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
        <p className="text-xs text-slate-500 mb-6">Consumida vs Contratada</p>

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

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Histórico de Leituras</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">Mês</th>
                <th className="px-6 py-3.5 text-center">Demanda (kW)</th>
                <th className="px-6 py-3.5 text-center">Consumo (kWh)</th>
                <th className="px-6 py-3.5 text-center">Custo (R$)</th>
                <th className="px-6 py-3.5 text-center">FP</th>
                <th className="px-6 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {readHistoryData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{row.month}</td>
                  <td className="px-6 py-4 text-center">{row.demand}</td>
                  <td className="px-6 py-4 text-center">{row.consumption}</td>
                  <td className="px-6 py-4 text-center">{row.cost}</td>
                  <td className="px-6 py-4 text-center">{row.fp.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                    {row.status === "Excedida" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-100">
                        <span className="text-xs">⚠️</span> Excedida
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <span className="text-xs">✔</span> OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
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