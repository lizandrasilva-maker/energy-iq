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
  // Créditos de geração (negativos) abatem a energia
  const energia = somaItens(f, "consumo_fora_ponta", "consumo_ponta", "bandeira", "compensacao");
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
  const P = f.medicao.demandaForaPontaKw, Q = f.medicao.demandaReativaForaPontaKvar || 0;
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
  const nada = { quantidade: 0, tarifa: 0, valor: 0 };
  const teFP = item(f, "consumo_fora_ponta", /\(TE\)/) || nada, teP = item(f, "consumo_ponta", /\(TE\)/) || nada;
  const kwh = teFP.quantidade + teP.quantidade;
  const teMedio = (teFP.quantidade * teFP.tarifa + teP.quantidade * teP.tarifa) / kwh; // R$/kWh sem tributos
  const teAtualMes = teFP.valor + teP.valor; // com tributos
  const k = fatorTributos(f.tributos);
  const economiaMes =
    precoMWh != null && precoMWh > 0 ? (teMedio - precoMWh / 1000) * kwh * k - (custosFixosMes || 0) : null;
  return { kwh, equilibrioMWh: teMedio * 1000, teAtualMes, economiaMes };
}

/**
 * Preço de referência de usina solar, informado pela equipe (out/2026):
 * usina de 108 kWp por cerca de R$ 200 mil. Usado quando o cliente ainda não
 * tem orçamento; o orçamento real da integradora substitui este valor.
 */
export const SOLAR_REFERENCIA = { kwp: 108, preco: 200000, data: "out/2026" };
export const CUSTO_KWP_REFERENCIA = SOLAR_REFERENCIA.preco / SOLAR_REFERENCIA.kwp;

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

const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const kw = (v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

/**
 * Diagnóstico da fatura por regras: o que chama atenção e o que fazer.
 * type: "danger" (multa evitável) | "warning" (atenção) | "success".
 */
export function diagnostico(f) {
  const out = [];
  const d = ajusteDemanda(f);
  const ultrapassagem = somaItens(f, "ultrapassagem");
  const reativo = somaItens(f, "reativo");
  const credito = -somaItens(f, "compensacao");

  if (ultrapassagem > 0) {
    out.push({
      type: "danger",
      title: `Multa de ultrapassagem de demanda: ${brl(ultrapassagem)} neste mês`,
      desc:
        `A demanda medida (${kw(f.medicao.demandaForaPontaKw)} kW) passou de 105% da contratada (${kw(f.demandaContratadaKw)} kW), ` +
        `e o excedente foi cobrado em dobro. ` +
        (d.economiaPeriodo > 1
          ? `Pelo histórico de ${d.meses} meses, o contrato de menor custo é ${kw(d.contratoSugeridoKw)} kW: cerca de ${brl(d.economiaMes)} por mês a menos.`
          : ""),
    });
  } else if (d.economiaPeriodo > 1) {
    out.push({
      type: "warning",
      title: `Contrato de demanda pode ser ajustado para ${kw(d.contratoSugeridoKw)} kW`,
      desc: `Pelo histórico de ${d.meses} meses, o contrato atual (${kw(f.demandaContratadaKw)} kW) não é o de menor custo. O ajuste economiza cerca de ${brl(d.economiaMes)} por mês.`,
    });
  }

  if (reativo > 0) {
    const fp = correcaoFP(f);
    out.push({
      type: reativo / f.subtotalFaturamento > 0.02 ? "danger" : "warning",
      title: `Reativo excedente: ${brl(reativo)} neste mês`,
      desc:
        `O fator de potência ficou abaixo de 0,92 (no pico, perto de ${fp.fpPico.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}). ` +
        `Um banco de capacitores de cerca de ${kw(Math.max(1, Math.round(fp.kvar / 10) * 10))} kvar elimina esta cobrança.`,
    });
  }

  if (credito > 0) {
    out.push({
      type: "success",
      title: `Créditos de geração abateram ${brl(credito)}`,
      desc: "Energia gerada e compensada nesta conta. Ela abate kWh, mas não reduz demanda, ultrapassagem nem reativo.",
    });
  }

  if (!out.length) {
    out.push({
      type: "success",
      title: "Sem multas nesta fatura",
      desc: "Demanda dentro do contrato e fator de potência dentro do limite. Veja em \"Onde economizar\" as opções para reduzir a energia.",
    });
  }
  return out;
}

export { billXray };
