// Normalização dos valores que a IA extrai da fatura.
// A IA pode devolver números como número JSON (225.46) ou como texto no
// formato brasileiro ("225,46", "20.450", "1.234,56"); meses como "09/2026",
// "2026-09" ou "set/2026".

/**
 * Converte número em texto (pt-BR ou internacional) para Number.
 * Regras:
 *  - "1.234,56" → 1234.56 (ponto = milhar, vírgula = decimal)
 *  - "225,46"   → 225.46
 *  - "20.450"   → 20450 (grupos de 3 dígitos após o ponto = milhar)
 *  - "225.46"   → 225.46 (ponto seguido de 1–2 ou 4+ dígitos = decimal)
 * Devolve `fallback` quando não há número legível.
 */
export function parseNumberBR(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;

  let s = String(value).trim().replace(/\s|R\$|kWh|kW|kvarh|%/gi, "");
  if (!s) return fallback;

  const hasComma = s.includes(","), hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // O último separador é o decimal
    s = s.lastIndexOf(",") > s.lastIndexOf(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  } else if (hasDot && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Converte o mês de referência para "AAAA-MM" (formato do histórico).
 * Aceita "09/2026", "9/2026", "2026-09", "09-2026", "set/2026", "SET/26".
 * Devolve null quando não reconhece.
 */
export function normalizeMonth(value) {
  if (!value) return null;
  const s = String(value).trim().toLowerCase();
  let m;
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})$/))) return fmt(m[1], m[2]);
  if ((m = s.match(/^(\d{1,2})[-/](\d{4})$/))) return fmt(m[2], m[1]);
  if ((m = s.match(/^([a-zç]{3})[a-zç]*[\s./-]*(\d{2}|\d{4})$/))) {
    const idx = MONTHS_PT.indexOf(m[1]);
    if (idx === -1) return null;
    const year = m[2].length === 2 ? `20${m[2]}` : m[2];
    return fmt(year, idx + 1);
  }
  return null;
}

function fmt(year, month) {
  const mm = Number(month);
  if (!(mm >= 1 && mm <= 12)) return null;
  return `${year}-${String(mm).padStart(2, "0")}`;
}
