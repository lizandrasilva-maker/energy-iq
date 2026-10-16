import { CheckCircle2, AlertTriangle, ScanLine } from "lucide-react";
import { billXray } from "@/lib/billXray";
import { mesBR } from "@/lib/currentBill";
import { useChartTheme } from "./charts/ChartKit";

const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/**
 * Raio-x da fatura: peso de cada componente no total da conta de energia,
 * do maior para o menor, com destaque para o que é evitável sem obra.
 */
export default function BillXrayCard({ fatura }) {
  const chart = useChartTheme();
  const x = billXray(fatura);
  const max = x.componentes[0]?.valor || 1;

  return (
    <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-sky-500" /> Raio-x da fatura
          </h2>
          <p className="text-xs text-slate-500">
            Quanto cada componente pesa na conta de energia de {mesBR(fatura.referencia)} ({brl(x.soma)})
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
            x.conferido ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
          }`}
          title="A soma dos itens lidos precisa ser igual ao subtotal impresso na fatura"
        >
          {x.conferido ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {x.conferido ? "Itens conferem com o subtotal" : `Diferença de ${brl(x.diferenca)} no subtotal`}
        </span>
      </div>

      <ul className="space-y-3.5">
        {x.componentes.map((c) => (
          <li key={c.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 items-baseline" title={c.nota}>
            <span className="text-sm font-medium text-slate-800 flex items-center gap-2 min-w-0">
              <span className="truncate">{c.label}</span>
              {c.evitavel && (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                  evitável
                </span>
              )}
            </span>
            <span className="text-sm tabular-nums text-slate-700">
              <span className="font-semibold text-slate-900">{pct(c.pct)}</span>
              <span className="text-slate-500"> · {brl(c.valor)}</span>
            </span>
            <span className="col-span-2 h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max(2, (Math.abs(c.valor) / max) * 100)}%`,
                  // Crédito de geração (negativo) em verde: abate a conta
                  background: c.evitavel ? chart.critical : c.valor < 0 ? chart.series[1] : chart.series[0],
                }}
              />
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Evitável sem obra nesta fatura</p>
          <p className="font-heading text-xl font-bold text-slate-900 tabular-nums mt-0.5">
            {brl(x.evitavel)} <span className="text-sm font-medium text-slate-500">({pct(x.pctEvitavel)})</span>
          </p>
          <p className="text-xs text-slate-600 mt-0.5">Ultrapassagem de demanda e reativo excedente: somem com ajuste de contrato e correção do fator de potência.</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">O que mais pesa</p>
          <p className="font-heading text-xl font-bold text-slate-900 mt-0.5">{x.maior?.label}</p>
          <p className="text-xs text-slate-600 mt-0.5">{x.maior?.nota}</p>
        </div>
      </div>

      {fatura.outros?.length > 0 && (
        <p className="mt-4 text-[11px] text-slate-500">
          Fora da conta de energia (não entram no raio-x):{" "}
          {fatura.outros.map((o) => `${o.descricao} ${brl(o.valor)}`).join(" · ")}. Total a pagar: {brl(fatura.total)}.
        </p>
      )}
    </div>
  );
}
