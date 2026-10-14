-- =====================================================================
-- EnergyIQ — NOVA VERSÃO (Supabase jgsyvjpygusebawsqyjs)
-- Junta as migrações 0003 e 0004. Rodar no SQL Editor deste projeto.
-- NÃO rodar no Supabase do projeto original (stvgfstapkecsnklldob).
-- =====================================================================

-- 0003: energia acumulada (kWh) e frequência (Hz) que o PZEM já mede
alter table public.measurements
  add column if not exists energy_kwh double precision,
  add column if not exists frequency double precision;

-- 0004: fecha a gravação pela chave pública; o ESP32 grava via /api/sensor
drop policy if exists "dev: gravacao de teste" on public.measurements;

-- Conferência: colunas (12) e políticas (deve sobrar só a de leitura)
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'measurements' order by ordinal_position;
select policyname, cmd from pg_policies where tablename = 'measurements';
