// Cálculos elétricos a partir das leituras do PZEM-004T.
//
// O PZEM-004T mede tensão (V), corrente (A), potência ativa (W), energia,
// frequência e fator de potência. Ele NÃO mede potência reativa nem
// harmônicas: a reativa abaixo é calculada a partir de P e FP.

// Faixa de medição do PZEM-004T v4 (100 A): 80–260 V, 0–100 A, até ~26 kW.
// Leituras fora dela são falhas de comunicação serial entre PZEM e ESP32
// (ex.: 289 MW / 4607 V / 3,4 MA gravados em 13/10/2026) e são descartadas.
export function isPlausibleReading(row) {
  const v = Number(row.voltage), i = Number(row.current), p = Number(row.power), pf = Number(row.power_factor);
  if (row.voltage != null && !(v >= 80 && v <= 260)) return false;
  if (row.current != null && !(i >= 0 && i <= 100)) return false;
  if (row.power != null && !(p >= 0 && p <= 26000)) return false;
  if (row.power_factor != null && !(pf >= 0 && pf <= 1)) return false;
  return true;
}

/** O PZEM envia potência em watts; o painel trabalha em kW. */
export const wattsToKw = (watts) => {
  const w = Number(watts);
  return Number.isFinite(w) ? w / 1000 : null;
};

const fmt = (value, digits) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits });

/** Potência legível: abaixo de 1 kW mostra em W (cargas de bancada), acima em kW. */
export function formatPower(kw) {
  if (kw === null || kw === undefined || !Number.isFinite(Number(kw))) return "—";
  const v = Number(kw);
  if (Math.abs(v) < 1) return `${fmt(v * 1000, 1)} W`;
  return `${fmt(v, 2)} kW`;
}

/** Mesma ideia para a reativa: var abaixo de 1 kvar, kvar acima. */
export function formatReactive(kvar) {
  if (kvar === null || !Number.isFinite(kvar)) return "—";
  if (Math.abs(kvar) < 1) return `${fmt(kvar * 1000, 1)} var`;
  return `${fmt(kvar, 2)} kvar`;
}

/**
 * Potência reativa estimada: Q = P · tan(acos FP).
 * Com corrente distorcida (cargas eletrônicas), o FP medido inclui o efeito
 * das harmônicas e este valor fica acima da reativa de deslocamento: é uma
 * estimativa, não uma medição.
 */
export function reactiveKvar(pKw, pf) {
  const p = Number(pKw), f = Number(pf);
  if (!Number.isFinite(p) || !Number.isFinite(f) || f <= 0 || f > 1) return null;
  return p * Math.tan(Math.acos(f));
}

/** Potência aparente: S = P / FP. */
export function apparentKva(pKw, pf) {
  const p = Number(pKw), f = Number(pf);
  if (!Number.isFinite(p) || !Number.isFinite(f) || f <= 0 || f > 1) return null;
  return p / f;
}

// Intervalo máximo entre duas leituras para considerar que o equipamento
// esteve ligado no meio-tempo. Acima disso (sensor desligado, sem Wi-Fi) o
// trecho não entra na conta de energia.
const MAX_GAP_MS = 5 * 60 * 1000;

const pad = (n) => String(n).padStart(2, "0");

function periodKey(date, period) {
  if (period === "monthly") return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  if (period === "weekly") {
    // Semana começando na segunda-feira
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function periodLabel(key, period) {
  const [y, m, d] = key.split("-");
  if (period === "monthly") return `${MONTHS[Number(m) - 1]}/${y.slice(2)}`;
  if (period === "weekly") return `sem. ${d}/${m}`;
  return `${d}/${m}`;
}

/**
 * Agrupa leituras ({created_at, power em W}) por dia, semana ou mês.
 * A energia é a integral da potência no tempo (regra do trapézio entre
 * leituras consecutivas), em kWh. Trechos com intervalo maior que
 * MAX_GAP_MS são ignorados.
 *
 * @returns {{periodLabel: string, energyKwh: number, avgPowerKw: number, samples: number}[]}
 */
export function aggregateEnergy(rows, period = "daily") {
  const points = rows
    .filter(isPlausibleReading)
    .map((r) => ({ t: new Date(r.created_at).getTime(), kw: wattsToKw(r.power) }))
    .filter((p) => Number.isFinite(p.t) && p.kw !== null)
    .sort((a, b) => a.t - b.t);

  const groups = new Map();
  const group = (key) => {
    if (!groups.has(key)) groups.set(key, { energyKwh: 0, sumKw: 0, samples: 0 });
    return groups.get(key);
  };

  points.forEach((p, i) => {
    const g = group(periodKey(new Date(p.t), period));
    g.sumKw += p.kw;
    g.samples += 1;
    const prev = points[i - 1];
    if (prev && p.t - prev.t <= MAX_GAP_MS) {
      const hours = (p.t - prev.t) / 3_600_000;
      // O trecho é creditado ao período da leitura final
      g.energyKwh += ((prev.kw + p.kw) / 2) * hours;
    }
  });

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, g]) => ({
      periodLabel: periodLabel(key, period),
      energyKwh: g.energyKwh,
      avgPowerKw: g.samples ? g.sumKw / g.samples : 0,
      samples: g.samples,
    }));
}
