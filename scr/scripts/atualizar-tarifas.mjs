// Atualiza as tarifas da Enel CE (subgrupo A4) a partir dos dados abertos da
// ANEEL e grava em src/data/tarifas-enel-ce-a4.json.
//
// Uso (na pasta scr):  node scripts/atualizar-tarifas.mjs
//
// Fonte: ANEEL — Tarifas homologadas das distribuidoras (dados abertos),
// a mesma base do painel https://portalrelatorios.aneel.gov.br/luznatarifa/basestarifas
// Valores SEM impostos (ICMS, PIS/COFINS) e SEM bandeira tarifária.

import { writeFileSync } from "node:fs";

const RESOURCE = "fcf2906c-7c32-4b9b-a637-054e7a5234f4"; // tarifas-homologadas-distribuidoras-energia-eletrica.csv
const API = "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search";
const AGENTE = "ENEL CE", SUBGRUPO = "A4";

const num = (s) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;

const filters = encodeURIComponent(JSON.stringify({ SigAgente: AGENTE, DscSubGrupo: SUBGRUPO, DscBaseTarifaria: "Tarifa de Aplicação" }));
const res = await fetch(`${API}?resource_id=${RESOURCE}&limit=5000&filters=${filters}`);
if (!res.ok) throw new Error(`ANEEL respondeu ${res.status}`);
const rows = (await res.json()).result.records;

// Resolução vigente = a de início de vigência mais recente que já começou
const hoje = new Date().toISOString().slice(0, 10);
const inicio = rows.map((r) => r.DatInicioVigencia).filter((d) => d <= hoje).sort().pop();
const vigente = rows.filter((r) => r.DatInicioVigencia === inicio && r.DscDetalhe === "Não se aplica");

const pick = (modalidade, posto, unidade) => {
  const r = vigente.find((x) => x.DscModalidadeTarifaria === modalidade && x.NomPostoTarifario === posto && x.DscUnidadeTerciaria === unidade);
  if (!r) throw new Error(`Tarifa não encontrada: ${modalidade} / ${posto} / ${unidade}`);
  return { tusd: num(r.VlrTUSD), te: num(r.VlrTE) };
};
// Energia vem em R$/MWh: converte para R$/kWh (TUSD + TE)
const energia = (m, p) => {
  const t = pick(m, p, "MWh");
  const r5 = (v) => Math.round(v * 1e5) / 1e5;
  return { tusd: r5(t.tusd / 1000), te: r5(t.te / 1000), total: r5((t.tusd + t.te) / 1000) };
};

const out = {
  distribuidora: AGENTE,
  subgrupo: SUBGRUPO,
  resolucao: vigente[0].DscREH,
  vigencia: { inicio, fim: vigente[0].DatFimVigencia },
  fonte: "ANEEL — Tarifas homologadas das distribuidoras (dados abertos)",
  atualizadoEm: hoje,
  observacao: "Tarifas de aplicação, sem ICMS/PIS/COFINS e sem bandeira tarifária. Energia em R$/kWh; demanda em R$/kW.",
  verde: {
    demanda: pick("Verde", "Não se aplica", "kW").tusd,
    energiaPonta: energia("Verde", "Ponta"),
    energiaForaPonta: energia("Verde", "Fora ponta"),
  },
  azul: {
    demandaPonta: pick("Azul", "Ponta", "kW").tusd,
    demandaForaPonta: pick("Azul", "Fora ponta", "kW").tusd,
    energiaPonta: energia("Azul", "Ponta"),
    energiaForaPonta: energia("Azul", "Fora ponta"),
  },
};

const destino = new URL("../src/data/tarifas-enel-ce-a4.json", import.meta.url);
writeFileSync(destino, JSON.stringify(out, null, 2) + "\n");
console.log(`Tarifas gravadas: ${out.resolucao} (vigência ${inicio} a ${out.vigencia.fim})`);
