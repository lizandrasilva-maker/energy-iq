// Kit visual dos gráficos (recharts) do EnergyIQ.
//
// Paleta categórica validada (dataviz/validate_palette.js, todas as
// verificações PASS) contra a superfície de cada tema:
//   claro  #ffffff: azul #1a8cff, verde #0e9c57
//   escuro #0f1c44: azul #1a8cff, verde #12b066
// Ordem fixa: série 1 = azul, série 2 = verde. Máximo 2 séries por gráfico.
// Linhas de referência (contratada, mínimo 0,92) usam tom neutro tracejado;
// vermelho fica reservado para estado crítico (ultrapassagem).
//
// O SVG do recharts não aceita var(--x) em atributos, por isso as cores
// saem daqui em hex conforme o tema ativo.

import { useId } from "react";
import { ResponsiveContainer, AreaChart, Area, YAxis } from "recharts";
import { useTheme } from "@/lib/theme";

const PALETTES = {
  light: {
    series: ["#1a8cff", "#0e9c57"],
    reference: "#64748b",
    critical: "#e11d48",
    grid: "#e2e8f2",
    axis: "#64748b",
    surface: "#ffffff",
    cursor: "#94a3b8",
  },
  dark: {
    series: ["#1a8cff", "#12b066"],
    reference: "#93a2c6",
    critical: "#fb7185",
    grid: "#22346a",
    axis: "#7484ad",
    surface: "#0f1c44",
    cursor: "#7484ad",
  },
};

export function useChartTheme() {
  const { theme } = useTheme();
  return PALETTES[theme === "dark" ? "dark" : "light"];
}

/** Props comuns de eixo: sem linhas, rótulos discretos. */
export const axisProps = (c) => ({
  axisLine: false,
  tickLine: false,
  tick: { fill: c.axis, fontSize: 11 },
  tickMargin: 8,
});

/** Grade só horizontal, tracejada e recessiva. */
export const gridProps = (c) => ({ vertical: false, stroke: c.grid, strokeDasharray: "3 6" });

/** Cursor vertical tracejado (linha/área). */
export const lineCursor = (c) => ({ stroke: c.cursor, strokeWidth: 1, strokeDasharray: "4 4" });

/** Cursor de barras: faixa leve atrás da barra. */
export const barCursor = (c) => ({ fill: c.grid, fillOpacity: 0.5 });

/** Ponto ativo com anel da cor da superfície (destaca sobre a linha). */
export const activeDot = (c, color) => ({ r: 5, fill: color, stroke: c.surface, strokeWidth: 2 });

/** Degradê vertical para área: cor forte no topo, transparente na base. */
export function AreaGradient({ id, color, from = 0.35, to = 0 }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={from} />
      <stop offset="100%" stopColor={color} stopOpacity={to} />
    </linearGradient>
  );
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "2025-08" → "ago/25" (outros formatos passam inalterados). */
export function formatMonth(value) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(value));
  return m ? `${MONTHS[Number(m[2]) - 1]}/${m[1].slice(2)}` : value;
}

const fmtNumber = (v, digits = 2) =>
  typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: digits }) : v;

/**
 * Caixa de informação no estilo cartão. O valor fica em cor de texto; a cor
 * da série aparece só na amostra ao lado (identidade nunca só pela cor do texto).
 * `format(value, entry)` devolve o texto do valor; `extra(payload)` linhas extras.
 */
export function ChartTooltip({ active, payload, label, format, labelFormat, extra }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value !== undefined && p.value !== null);
  if (!rows.length) return null;
  const [main, ...rest] = rows;
  const swatch = (p) =>
    p.payload?.__swatch || p.color || p.stroke || p.fill;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 backdrop-blur px-3.5 py-2.5 shadow-lg min-w-[150px]">
      <p className="text-[11px] font-medium text-slate-500">{labelFormat ? labelFormat(label, rows) : label}</p>
      <p className="mt-0.5 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: swatch(main) }} />
        <span className="font-heading text-lg font-bold text-slate-900 tabular-nums">
          {format ? format(main.value, main) : fmtNumber(main.value)}
        </span>
      </p>
      <p className="text-[11px] text-slate-500 -mt-0.5 ml-[18px]">{main.name}</p>
      {rest.map((p) => (
        <p key={p.dataKey} className="mt-1.5 flex items-center gap-2 text-xs text-slate-600">
          <span className="h-0.5 w-3 rounded-full shrink-0" style={{ background: swatch(p) }} />
          <span>{p.name}:</span>
          <span className="font-semibold text-slate-800 tabular-nums">{format ? format(p.value, p) : fmtNumber(p.value)}</span>
        </p>
      ))}
      {extra && <div className="mt-1.5 text-[11px] text-slate-500">{extra(main.payload)}</div>}
    </div>
  );
}

/**
 * Legenda com amostras de traço (contínuo, tracejado ou barra), como
 * "— Medida  - - Contratada". Use em gráficos com 2 ou mais séries.
 * items: [{ label, color, kind: "line" | "dashed" | "bar" | "area" }]
 */
export function ChartLegend({ items }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 pt-3 text-xs text-slate-600">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-2">
          {it.kind === "bar" ? (
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: it.color }} />
          ) : (
            <svg width="22" height="8" aria-hidden="true">
              <line
                x1="1" y1="4" x2="21" y2="4"
                stroke={it.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={it.kind === "dashed" ? "4 4" : undefined}
              />
            </svg>
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Minigráfico de área para cartões de indicador (sem eixos nem interação). */
export function Sparkline({ data, dataKey, color, height = 40 }) {
  const id = useId().replace(/:/g, "");
  if (!data?.length) return null;
  return (
    <div style={{ height }} className="w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <AreaGradient id={`spark-${id}`} color={color} from={0.3} />
          </defs>
          {/* Minigráfico mostra a forma da tendência: escala do menor ao maior valor */}
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#spark-${id})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
