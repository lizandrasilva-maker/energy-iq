// "Onde economizar": o que cada solução consegue reduzir na conta, a partir
// da fatura do cliente. Regras fixas e verificáveis; o que depende de
// fornecedor (preço do mercado livre, custo da usina solar, preço do banco
// de capacitores) entra como premissa informada pelo usuário, nunca inventada.

import { billXray, simularContratoDemanda } from "./billXray.js";
import { capacitorKvar, PF_MIN } from "./electrical.js";

const somaItens = (f, ...componentes) =>
  f.itens.filter((i) => componentes.includes(i.componente)).reduce((t, i) => t + i.valor, 0);
const item = (f, componente, re) => f.itens.find((i) => i.componente === componente && (!re || re.test(i.descricao)));

/** Fator que leva a tarifa sem tributos ao preço com tributos (ICMS "por dentro"). */
export const fatorTributos = ({ icms, pis, cofins }) => 1 / ((1 - pis - cofins) * (1 - icms));

/** Partes da conta por natureza: energia (kWh), demanda (kW) e reativo. */
export function partesDaConta(f) {
  const energia = somaItens(f, "consumo_fora_ponta", "consumo_ponta", "bandeira");
  const demanda = somaItens(f, "demanda", "ultrapassagem");
  const reativo = somaItens(f, "reativo");
  const total = f.subtotalFaturamento;
  return { energia, demanda, reativo, total };
}

/** 1. Ajustar o contrato de demanda (sem obra, sem investimento). */
export function ajusteDemanda(f) {
  const tarifa = item(f, "demanda").precoComTributos;
  const s = simularContratoDemanda(f.historico, f.demandaContratadaKw, tarifa);
  return {
    contratoAtualKw: f.demandaContratadaKw,
    contratoSugeridoKw: s.otimo.contratoKw,
    economiaPeriodo: s.economia,
    meses: s.meses,
    economiaMes: s.economia / s.meses,
  };
}

/** 2. Corrigir o fator de potência (banco de capacitores). */
export function correcaoFP(f) {
  const P = f.medicao.demandaForaPontaKw, Q = f.medicao.demandaReativaForaPontaKvar;
  const fpPico = P / Math.hypot(P, Q);
  return { economiaMes: somaItens(f, "reativo"), fpPico, kvar: capacitorKvar(P, fpPico, PF_MIN) };
}

/**
 * 3. Mercado livre: troca a TE (energia) por um contrato com comercializadora.
 * Continuam: TUSD, demanda e reativo. Ponto de equilíbrio = TE média atual
 * sem tributos (R$/MWh): abaixo dele, o preço ofertado já economiza (antes
 * dos custos de gestão e da CCEE, informados à parte).
 */
export function mercadoLivre(f, { precoMWh = null, custosFixosMes = 0 } = {}) {
  const teFP = item(f, "consumo_fora_ponta", /\(TE\)/), teP = item(f, "consumo_ponta", /\(TE\)/);
  const kwh = teFP.quantidade + teP.quantidade;
  const teMedio = (teFP.quantidade * teFP.tarifa + teP.quantidade * teP.tarifa) / kwh; // R$/kWh sem tributos
  const teAtualMes = teFP.valor + teP.valor; // com tributos
  const k = fatorTributos(f.tributos);
  const economiaMes =
    precoMWh != null && precoMWh > 0 ? (teMedio - precoMWh / 1000) * kwh * k - (custosFixosMes || 0) : null;
  return { kwh, equilibrioMWh: teMedio * 1000, teAtualMes, economiaMes };
}

/**
 * 4. Geração solar (GD). Dimensiona para cobrir uma fração do consumo fora
 * de ponta e estima a economia MÁXIMA (energia compensada × preço da energia
 * fora ponta com tributos). Não reduz demanda, ultrapassagem nem reativo.
 * Não desconta a parcela do Fio B (Lei 14.300/2022), que reduz parte do ganho.
 */
export function solar(f, { hsp = 5.5, pr = 0.8, cobertura = 0.5, custoKwp = null, m2PorKwp = 6 } = {}) {
  const kwhMes = f.medicao.energiaForaPontaKwh * cobertura;
  const kwp = kwhMes / (hsp * 30 * pr);
  const precoFP = somaItens(f, "consumo_fora_ponta") / f.medicao.energiaForaPontaKwh; // R$/kWh com tributos (TE+TUSD)
  const economiaMes = kwhMes * precoFP;
  const investimento = custoKwp && custoKwp > 0 ? kwp * custoKwp : null;
  return {
    kwhMes,
    kwp,
    areaM2: kwp * m2PorKwp,
    economiaMes,
    investimento,
    paybackAnos: investimento ? investimento / (economiaMes * 12) : null,
    naoReduz: somaItens(f, "demanda", "ultrapassagem", "reativo"),
  };
}

/** Resumo do que dá para reduzir sem obra (contrato + fator de potência). */
export function semObra(f) {
  return ajusteDemanda(f).economiaMes + correcaoFP(f).economiaMes;
}

export { billXray };
