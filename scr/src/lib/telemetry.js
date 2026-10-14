// Leitura das medições dos sensores a partir das DUAS fontes:
// a nova versão (banco próprio) e o protótipo original (somente leitura).
// Regra: para cada sensor vale quem enviou por último ("quem estiver online
// puxa"); o histórico junta as duas fontes em ordem de tempo.

import { supabase, supabaseOriginal } from "./supabase";

export const SOURCES = [
  { id: "nova", label: "Nova versão", client: supabase },
  { id: "original", label: "Protótipo original", client: supabaseOriginal },
].filter((s) => s.client);

export const SOURCE_LABEL = Object.fromEntries(SOURCES.map((s) => [s.id, s.label]));

/** Sensor online = leitura nos últimos 2 minutos (o firmware envia a cada 3 s). */
export const ONLINE_MS = 2 * 60 * 1000;
export const isOnline = (iso, now = Date.now()) => !!iso && now - Date.parse(iso) < ONLINE_MS;

const byTimeDesc = (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at);

// Uma fonte fora do ar não pode segurar a outra: a biblioteca do Supabase
// fica tentando de novo por bastante tempo, então cada consulta tem limite.
const SOURCE_TIMEOUT_MS = 6000;

/** Consulta uma fonte; devolve { rows } ou { rows: [], failed } (erro ou tempo esgotado). */
async function queryOne(s, build) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ rows: [], failed: s.id }), SOURCE_TIMEOUT_MS);
  });
  const query = (async () => {
    try {
      const { data, error } = await build(s.client.from("measurements"));
      if (error) return { rows: [], failed: s.id };
      return { rows: (data || []).map((r) => ({ ...r, source: s.id })) };
    } catch {
      return { rows: [], failed: s.id };
    }
  })();
  const result = await Promise.race([query, timeout]);
  clearTimeout(timer);
  return result;
}

/**
 * Entrega as leituras recentes de CADA fonte assim que ela responde
 * (onRows(rows, sourceId)), sem esperar a outra. onDone(failedIds) no fim.
 */
export function streamRecent(limitPerSource, onRows, onDone) {
  const failed = [];
  let cancelled = false;
  Promise.all(
    SOURCES.map((s) =>
      queryOne(s, (q) => q.select("*").order("created_at", { ascending: false }).limit(limitPerSource)).then((r) => {
        if (cancelled) return;
        if (r.failed) failed.push(r.failed);
        else onRows(r.rows, s.id);
      })
    )
  ).then(() => !cancelled && onDone?.(failed));
  return () => {
    cancelled = true;
  };
}

/**
 * Roda a mesma consulta nas fontes e junta o resultado, marcando a origem
 * de cada linha. Uma fonte com erro (fora do ar) não derruba a outra.
 */
async function queryAll(build) {
  const parts = await Promise.all(SOURCES.map((s) => queryOne(s, build)));
  const rows = parts.flatMap((p) => p.rows).sort(byTimeDesc);
  const failed = parts.map((p) => p.failed).filter(Boolean);
  if (failed.length === SOURCES.length) throw new Error("Nenhuma fonte de medições respondeu.");
  return { rows, failed };
}

/** Leituras mais recentes de todas as fontes (ordem decrescente de tempo). */
export function fetchRecent(limitPerSource = 200) {
  return queryAll((q) => q.select("*").order("created_at", { ascending: false }).limit(limitPerSource));
}

/** Histórico de um sensor nas duas fontes, sem duplicar leituras idênticas. */
export async function fetchSensorRows(sensorId, limitPerSource = 5000) {
  const res = await queryAll((q) =>
    q
      .select("created_at, power, voltage, current, power_factor")
      .eq("sensor_id", sensorId)
      .order("created_at", { ascending: false })
      .limit(limitPerSource)
  );
  const seen = new Set();
  res.rows = res.rows.filter((r) => {
    const k = `${r.created_at}|${r.power}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return res;
}

/** Novas leituras em tempo real das duas fontes. Devolve a função para cancelar. */
export function subscribeMeasurements(onRow) {
  const channels = SOURCES.map((s) =>
    s.client
      .channel(`measurements-${s.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "measurements" }, (payload) => {
        if (payload.new) onRow({ ...payload.new, source: s.id });
      })
      .subscribe()
  );
  return () => channels.forEach((c, i) => SOURCES[i].client.removeChannel(c));
}
