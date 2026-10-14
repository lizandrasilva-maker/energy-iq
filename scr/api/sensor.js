// Função serverless: recebe as medições do ESP32 + PZEM e grava no Supabase.
// Versão Vercel da antiga netlify/functions/sensor.js, com o mesmo formato
// de entrada (sensor_id, voltage, current, power, power_factor,
// estimated_monthly_cost) e duas proteções a mais:
//  - se DEVICE_TOKEN estiver definido, exige o cabeçalho x-device-token;
//  - descarta leituras fora da faixa do PZEM-004T (falha de serial).
//
// Variáveis no servidor: SUPABASE_URL e SUPABASE_KEY (chave com permissão
// de gravação; nunca usar no navegador) e, opcional, DEVICE_TOKEN.

import { createClient } from "@supabase/supabase-js";
import { isPlausibleReading } from "../src/lib/electrical.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-device-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request) {
  const { SUPABASE_URL, SUPABASE_KEY, DEVICE_TOKEN } = process.env;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return json({ error: "Variáveis SUPABASE_URL ou SUPABASE_KEY não configuradas." }, 500);
  }
  if (DEVICE_TOKEN && request.headers.get("x-device-token") !== DEVICE_TOKEN) {
    return json({ error: "Dispositivo não autorizado." }, 401);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  if (!data?.sensor_id) return json({ error: "Campo sensor_id obrigatório." }, 400);

  const row = {
    sensor_id: String(data.sensor_id),
    voltage: data.voltage ?? null,
    current: data.current ?? null,
    power: data.power ?? null,
    power_factor: data.power_factor ?? null,
    estimated_monthly_cost: data.estimated_monthly_cost ?? null,
  };
  // Harmônicas só quando o medidor enviar (exige a migração 0002 no banco)
  if (data.thd_current != null) row.thd_current = data.thd_current;
  if (data.thd_voltage != null) row.thd_voltage = data.thd_voltage;

  if (!isPlausibleReading(row)) {
    // 200 para o ESP32 não ficar reenviando uma leitura corrompida
    return json({ message: "Leitura fora da faixa do sensor descartada.", discarded: true });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { error } = await supabase.from("measurements").insert([row]);
  if (error) return json({ error: error.message }, 500);

  return json({ message: "Dados gravados no Supabase com sucesso!" });
}
