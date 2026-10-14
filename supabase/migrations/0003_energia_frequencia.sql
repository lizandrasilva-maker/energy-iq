-- Energia acumulada (kWh) e frequência (Hz) que o PZEM-004T já mede.
-- Rodar ANTES de ligar ENVIAR_ENERGIA_FREQ no firmware: sem estas colunas o
-- Supabase recusa a gravação inteira (coluna inexistente).
-- Pode rodar no banco de testes e no de produção (não apaga nada).

alter table public.measurements
  add column if not exists energy_kwh double precision,  -- contador acumulado do PZEM, kWh
  add column if not exists frequency double precision;   -- Hz
