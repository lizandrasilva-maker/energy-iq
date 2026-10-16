import { useChartTheme } from "./ChartKit";

// Escala de 0,6 a 1,0: abaixo de 0,6 o ponteiro fica no início
const MIN = 0.6, MAX = 1, META = 0.92;
const CX = 110, CY = 104, R = 84, W = 12;

/** Ponto do arco (semicírculo de MIN, à esquerda, a MAX, à direita). */
const ponto = (v, r = R) => {
  const t = (Math.min(MAX, Math.max(MIN, v)) - MIN) / (MAX - MIN);
  const a = Math.PI * (1 - t);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
};
const arco = (de, ate) => {
  const [x1, y1] = ponto(de), [x2, y2] = ponto(ate);
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
};
const fmt = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Medidor do fator de potência: ponteiro de hoje (vermelho se abaixo de 0,92)
 * e, tracejado em verde, onde o banco de capacitores leva (meta 0,92).
 */
export default function PfGauge({ value, label = "fator de potência" }) {
  const c = useChartTheme();
  const ok = value >= META;
  const corHoje = ok ? c.series[1] : c.critical;
  const [hx, hy] = ponto(value, R - W - 6);
  const [mx, my] = ponto(META, R - W - 6);
  const [tx1, ty1] = ponto(META, R + W / 2 + 2), [tx2, ty2] = ponto(META, R + W / 2 + 9);
  const [lx, ly] = ponto(META, R + W / 2 + 18);

  return (
    <figure className="w-full max-w-[260px] mx-auto">
      <svg viewBox="0 0 220 120" className="w-full" role="img" aria-label={`${label}: ${fmt(value)}; meta 0,92`}>
        {/* Faixas: multa (abaixo de 0,92) e ok */}
        <path d={arco(MIN, META)} fill="none" stroke={c.critical} strokeOpacity="0.5" strokeWidth={W} />
        <path d={arco(META, MAX)} fill="none" stroke={c.series[1]} strokeWidth={W} />

        {/* Marca da meta, por fora do arco */}
        <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke={c.axis} strokeWidth="2" />
        <text x={lx} y={ly} fontSize="10" fontWeight="600" fill={c.axis} textAnchor="middle">0,92</text>
        <text x={ponto(MIN, R)[0]} y={CY + 14} fontSize="10" fill={c.axis} textAnchor="middle">0,6</text>
        <text x={ponto(MAX, R)[0]} y={CY + 14} fontSize="10" fill={c.axis} textAnchor="middle">1,0</text>

        {/* Com o banco: ponteiro tracejado na meta */}
        {!ok && <line x1={CX} y1={CY} x2={mx} y2={my} stroke={c.series[1]} strokeWidth="2.5" strokeDasharray="4 4" strokeLinecap="round" />}
        {/* Hoje */}
        <line x1={CX} y1={CY} x2={hx} y2={hy} stroke={corHoje} strokeWidth="4" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="6" fill={corHoje} stroke={c.surface} strokeWidth="2" />
      </svg>
      <figcaption className="mt-1 flex items-center justify-center gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: corHoje }} />
          hoje <strong className="font-heading text-base text-slate-900 tabular-nums">{fmt(value)}</strong>
        </span>
        {!ok && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed" style={{ borderColor: c.series[1] }} />
            com o banco <strong className="font-heading text-base text-slate-900 tabular-nums">0,92</strong>
          </span>
        )}
      </figcaption>
    </figure>
  );
}
