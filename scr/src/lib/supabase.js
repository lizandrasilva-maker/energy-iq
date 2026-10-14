import { createClient } from "@supabase/supabase-js";

// Duas fontes de medições (ver src/lib/telemetry.js):
//
// 1. NOVA VERSÃO — banco próprio desta versão do EnergyIQ. Endereço e chave
//    pública vêm das variáveis de ambiente (scr/.env.local em desenvolvimento,
//    painel da Vercel em produção). É o único banco em que esta versão grava
//    (via /api/sensor, no servidor).
//
// 2. PROTÓTIPO ORIGINAL — banco do projeto original (do orientador), onde o
//    ESP32 com o firmware v1 continua gravando. Esta versão só LÊ dele;
//    nunca grava nem altera nada lá. A chave anon é pública por natureza
//    (é a mesma que está no site e no firmware originais).

const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

export const supabase = url && key ? createClient(url, key, { auth: { ...auth, storageKey: "eiq-nova" } }) : null;

if (!supabase && import.meta.env.DEV) {
  console.warn(
    "[EnergyIQ] VITE_SUPABASE_URL/VITE_SUPABASE_KEY não definidos: só a fonte do protótipo original será lida. " +
      "Veja scr/.env.example."
  );
}

const ORIGINAL = {
  url: import.meta.env.VITE_SUPABASE_ORIGINAL_URL || "https://stvgfstapkecsnklldob.supabase.co",
  key:
    import.meta.env.VITE_SUPABASE_ORIGINAL_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0dmdmc3RhcGtlY3Nua2xsZG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MzU0MDQsImV4cCI6MjEwNzQxMTQwNH0.ZKiodIGet1oSXHH4CC73CIpj-6Pt2TUfez6o59mNV5c",
};

/** Somente leitura. Não usar para insert/update/delete. */
export const supabaseOriginal = createClient(ORIGINAL.url, ORIGINAL.key, {
  auth: { ...auth, storageKey: "eiq-original" },
});
