import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://stvgfstapkecsnklldob.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0dmdmc3RhcGtlY3Nua2xsZG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MzU0MDQsImV4cCI6MjEwNzQxMTQwNH0.ZKiodIGet1oSXHH4CC73CIpj-6Pt2TUfez6o59mNV5c";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);