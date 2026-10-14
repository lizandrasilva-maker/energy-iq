-- Nova versão: o ESP32 (firmware v2) grava pela função /api/sensor, que usa a
-- chave secreta no servidor. A gravação com a chave pública (anon) deixa de
-- ser necessária e é fechada: o site continua só LENDO as medições.

drop policy if exists "dev: gravacao de teste" on public.measurements;
