import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Sparkline } from "./ChartKit";

const PF_MIN = 0.92;

/** Anel do fator de potência com marca no mínimo regulatório (0,92). */
function PfRing({ value }) {
  const size = 64, stroke = 7, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  const ok = v >= PF_MIN;
  const mark = PF_MIN * 360 - 90; // posição do 0,92 no anel (graus a partir do topo)
  const rad = (mark * Math.PI) / 180;
  const mx = size / 2 + r * Math.cos(rad), my = size / 2 + r * Math.sin(rad);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-slate-100" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className={ok ? "stroke-emerald-500" : "stroke-amber-500"}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${v * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <circle cx={mx} cy={my} r={3} className="fill-slate-700 stroke-white" strokeWidth={1.5} />
    </svg>
  );
}

/**
 * Cartão de indicador no estilo do painel: rótulo, valor, e opcionalmente
 * minigráfico (spark + sparkKey), variação vs período anterior (delta, em %)
 * ou anel do fator de potência (gauge).
 */
export default function KpiCard({ label, value, unit, icon: Icon, spark, sparkKey, sparkColor, delta, gauge, note }) {
  return (
    <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="font-heading text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {value} {unit && <span className="text-sm font-normal text-slate-500">{unit}</span>}
          </p>
        </div>
        {gauge !== undefined ? (
          <PfRing value={gauge} />
        ) : (
          Icon && (
            <div className="p-2.5 bg-slate-100 text-slate-500 rounded-xl shrink-0">
              <Icon className="h-5 w-5" />
            </div>
          )
        )}
      </div>

      {spark && <Sparkline data={spark} dataKey={sparkKey} color={sparkColor} />}

      {delta !== undefined && delta !== null && Number.isFinite(delta) && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          {delta >= 0 ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-700" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 text-slate-700" />
          )}
          <span className="font-semibold text-slate-700 tabular-nums">
            {Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
          </span>
          vs mês anterior
        </p>
      )}

      {gauge !== undefined && (
        <p className="text-xs text-slate-500">
          {Number(gauge) >= PF_MIN ? (
            <><span className="font-semibold text-emerald-700">Acima</span> do mínimo de 0,92</>
          ) : (
            <><span className="font-semibold text-amber-700">Abaixo</span> do mínimo de 0,92: há cobrança de reativo</>
          )}
        </p>
      )}

      {note && <p className="text-xs text-slate-500">{note}</p>}
    </div>
  );
}
