import { useChartTheme } from "./ChartKit";

const MIN = 0.5, MAX = 1, META = 0.92;
const CX = 100, CY = 100, R = 78;

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

/** Medidor do fator de potência: faixa de multa (abaixo de 0,92) e a meta. */
export default function PfGauge({ value, label = "fator de potência" }) {
  const c = useChartTheme();
  const ok = value >= META;
  const [nx, ny] = ponto(value, R - 20);
  const [mx1, my1] = ponto(META, R - 12), [mx2, my2] = ponto(META, R + 12);
  const [lx, ly] = ponto(META, R - 30);

  return (
    <svg viewBox="0 0 200 122" className="w-full max-w-[240px]" role="img" aria-label={`${label}: ${fmt(value)}; meta 0,92`}>
      <path d={arco(MIN, MAX)} fill="none" stroke={c.grid} strokeWidth="14" strokeLinecap="round" />
      <path d={arco(MIN, META)} fill="none" stroke={c.critical} strokeOpacity="0.85" strokeWidth="14" strokeLinecap="round" />
      <path d={arco(META, MAX)} fill="none" stroke={c.series[1]} strokeWidth="14" />
      <line x1={mx1} y1={my1} x2={mx2} y2={my2} stroke={c.axis} strokeWidth="2" />
      <text x={lx} y={ly} fontSize="9" fill={c.axis} textAnchor="end">meta 0,92</text>
      <line x1={CX} y1={CY} x2={nx} y2={ny} stroke={ok ? c.series[1] : c.critical} strokeWidth="4" strokeLinecap="round" />
      <circle cx={CX} cy={CY} r="6" fill={ok ? c.series[1] : c.critical} />
      <text x={CX} y={CY + 20} fontSize="20" fontWeight="700" fill="currentColor" textAnchor="middle">{fmt(value)}</text>
      <text x="22" y="118" fontSize="9" fill={c.axis} textAnchor="middle">0,5</text>
      <text x="178" y="118" fontSize="9" fill={c.axis} textAnchor="middle">1,0</text>
    </svg>
  );
}
