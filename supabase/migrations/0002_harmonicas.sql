-- Harmônicas medidas (modo "real" do painel de Sensores).
-- O PZEM-004T não mede harmônicas: estas colunas ficam vazias até o ESP32
-- passar a enviar THD de um medidor que tenha essa medição. Enquanto vazias,
-- o painel mostra o THD simulado pelo tipo de carga.
-- Rodar no banco de testes; em produção, rodar ANTES de o firmware enviar
-- esses campos (senão a gravação falha por coluna inexistente).

alter table public.measurements
  add column if not exists thd_current double precision,  -- THD de corrente, %
  add column if not exists thd_voltage double precision;  -- THD de tensão, %
