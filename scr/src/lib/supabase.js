import { createClient } from "@supabase/supabase-js";

// Endereço e chave pública vêm das variáveis de ambiente (scr/.env.local em
// desenvolvimento, painel da Netlify em produção). Ver scr/.env.example.
//
// Enquanto as variáveis não estiverem cadastradas na Netlify, o build de
// produção usa o banco de produção abaixo, para o site no ar não parar.
// A chave anon é pública por natureza (a segurança fica nas regras RLS).
// Remover este fallback depois de cadastrar VITE_SUPABASE_URL e
// VITE_SUPABASE_KEY na Netlify.
const PRODUCTION_FALLBACK = {
  url: "https://stvgfstapkecsnklldob.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0dmdmc3RhcGtlY3Nua2xsZG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MzU0MDQsImV4cCI6MjEwNzQxMTQwNH0.ZKiodIGet1oSXHH4CC73CIpj-6Pt2TUfez6o59mNV5c",
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || PRODUCTION_FALLBACK.url;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || PRODUCTION_FALLBACK.key;

if (import.meta.env.DEV && !import.meta.env.VITE_SUPABASE_URL) {
  console.warn(
    "[EnergyIQ] VITE_SUPABASE_URL não definido: usando o banco de PRODUÇÃO. " +
      "Crie scr/.env.local a partir de scr/.env.example para usar o banco de testes."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
