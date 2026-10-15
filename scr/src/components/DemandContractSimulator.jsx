import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, ReferenceLine } from "recharts";
import { Target } from "lucide-react";
import { simularContratoDemanda } from "@/lib/billXray";
import { useChartTheme, ChartTooltip, ChartLegend, axisProps, gridProps, lineCursor, activeDot } from "./charts/ChartKit";

const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Simulador de contrato de demanda: custo total de demanda no histórico
 * para cada valor de contrato, com o contrato atual e o de menor custo.
 */
export default function DemandContractSimulator({ historico, contratoAtualKw, tarifaKw, chave = "demandaForaPontaKw" }) {
  const chart = useChartTheme();
  const s = useMemo(
    () => simularContratoDemanda(historico, contratoAtualKw, tarifaKw, { chave }),
    [historico, contratoAtualKw, tarifaKw, chave]
  );
  const pctEco = s.atual.custo ? s.economia / s.atual.custo : 0;

  return (
    <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Target className="h-4 w-4 text-sky-500" /> Simulação do contrato de demanda
          </h2>
          <p className="text-xs text-slate-500">
            Custo de demanda + ultrapassagem nos {s.meses} meses do histórico, para cada valor de contrato
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Contrato atual</p>
          <p className="font-heading text-lg font-bold text-slate-900 tabular-nums">{s.atual.contratoKw.toLocaleString("pt-BR")} kW</p>
          <p className="text-xs text-slate-500 tabular-nums">{brl(s.atual.custo)} em {s.meses} meses</p>
        </div>
        <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Contrato de menor custo</p>
          <p className="font-heading text-lg font-bold text-slate-900 tabular-nums">{s.otimo.contratoKw.toLocaleString("pt-BR")} kW</p>
          <p className="text-xs text-slate-500 tabular-nums">{brl(s.otimo.custo)} em {s.meses} meses</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Economia</p>
          <p className="font-heading text-lg font-bold text-slate-900 tabular-nums">{brl(s.economia)}</p>
          <p className="text-xs text-slate-500">
            {(pctEco * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% do custo de demanda no período
          </p>
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={s.curva} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid {...gridProps(chart)} />
            <XAxis dataKey="contratoKw" type="number" domain={["dataMin", "dataMax"]} {...axisProps(chart)} unit=" kW" />
            <YAxis {...axisProps(chart)} width={64} tickFormatter={(v) => `${Math.round(v / 1000).toLocaleString("pt-BR")} mil`} />
            <Tooltip
              cursor={lineCursor(chart)}
              content={
                <ChartTooltip
                  labelFormat={(l) => `Contrato de ${Number(l).toLocaleString("pt-BR")} kW`}
                  format={(v) => brl(v)}
                  extra={(d) => `Economia vs atual: ${brl(s.atual.custo - d.custo)}`}
                />
              }
            />
            <ReferenceLine x={s.otimo.contratoKw} stroke={chart.reference} strokeDasharray="5 5" />
            <Line type="monotone" dataKey="custo" name="Custo no período" stroke={chart.series[0]} strokeWidth={2} dot={false} activeDot={activeDot(chart, chart.series[0])} />
            <ReferenceDot x={s.atual.contratoKw} y={s.atual.custo} r={5} fill={chart.critical} stroke={chart.surface} strokeWidth={2} />
            <ReferenceDot x={s.otimo.contratoKw} y={s.otimo.custo} r={5} fill={chart.series[1]} stroke={chart.surface} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        items={[
          { label: "Custo no período", color: chart.series[0], kind: "line" },
          { label: `Atual (${s.atual.contratoKw} kW)`, color: chart.critical, kind: "bar" },
          { label: `Menor custo (${s.otimo.contratoKw} kW)`, color: chart.series[1], kind: "bar" },
        ]}
      />
      <p className="mt-3 text-[11px] text-slate-500">
        Regra: paga-se o maior entre demanda medida e contratada; acima de 105% da contratada, o excedente é cobrado em dobro
        (ultrapassagem). Tarifa de demanda com tributos da fatura de referência, igual em todos os meses: compara contratos, não prevê faturas.
      </p>
    </div>
  );
}
