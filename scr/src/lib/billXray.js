// Raio-x da fatura do Grupo A: quanto cada componente pesa no total.
// Cálculo por regras fixas sobre os itens da fatura (a IA só lê a fatura;
// as contas são feitas aqui, verificáveis).

/** Preço com tributos a partir da tarifa ANEEL: tarifa ÷ [(1 − PIS − COFINS) × (1 − ICMS)]. */
export function precoComTributos(tarifa, { icms, pis, cofins }) {
  return tarifa / ((1 - pis - cofins) * (1 - icms));
}

/** Tolerância de ultrapassagem: demanda medida acima de 105% da contratada (REN ANEEL 1.000/2021). */
export const TOLERANCIA_ULTRAPASSAGEM = 1.05;

export const COMPONENTES = {
  consumo_fora_ponta: {
    label: "Consumo fora de ponta",
    evitavel: false,
    nota: "Energia usada fora das 3 h de ponta. Reduz com eficiência ou geração própria (solar abate kWh).",
  },
  consumo_ponta: {
    label: "Consumo na ponta",
    evitavel: false,
    nota: "Energia nas 3 h de ponta, a mais cara na modalidade Verde. Deslocar carga para fora da ponta reduz.",
  },
  demanda: {
    label: "Demanda",
    evitavel: false,
    nota: "Potência faturada (o maior valor entre a medida e a contratada). Não é reduzida por geração solar.",
  },
  ultrapassagem: {
    label: "Ultrapassagem de demanda",
    evitavel: true,
    nota: "Multa: a parte acima da contratada é cobrada em dobro. Some ao readequar o contrato de demanda.",
  },
  reativo: {
    label: "Reativo excedente",
    evitavel: true,
    nota: "Cobrado quando o fator de potência fica abaixo de 0,92. Some com correção do FP (banco de capacitores).",
  },
  bandeira: {
    label: "Bandeira tarifária",
    evitavel: false,
    nota: "Adicional definido pela ANEEL conforme o custo de geração do mês. Fora do controle do cliente.",
  },
  compensacao: {
    label: "Créditos de geração",
    evitavel: false,
    nota: "Energia gerada (solar, por exemplo) e compensada nesta conta. Abate kWh; não abate demanda nem reativo.",
  },
};

/**
 * Agrupa os itens da fatura por componente, ordenado do maior para o menor,
 * com percentual sobre o subtotal de energia e conferência da soma.
 */
export function billXray(fatura) {
  const grupos = new Map();
  for (const it of fatura.itens) {
    grupos.set(it.componente, (grupos.get(it.componente) || 0) + it.valor);
  }
  const soma = [...grupos.values()].reduce((a, b) => a + b, 0);
  const componentes = [...grupos.entries()]
    .map(([key, valor]) => ({ key, valor, pct: soma ? valor / soma : 0, ...(COMPONENTES[key] || { label: key }) }))
    .sort((a, b) => b.valor - a.valor);

  const evitavel = componentes.filter((c) => c.evitavel).reduce((a, c) => a + c.valor, 0);
  const diferenca = Math.round((soma - fatura.subtotalFaturamento) * 100) / 100;
  return {
    componentes,
    soma,
    evitavel,
    pctEvitavel: soma ? evitavel / soma : 0,
    // Conferência: a soma dos itens precisa bater com o subtotal impresso
    conferido: Math.abs(diferenca) <= 0.05,
    diferenca,
    maior: componentes[0] || null,
  };
}

/**
 * Custo de demanda de um mês para um contrato: paga-se o maior entre medida
 * e contratada; acima de 105% da contratada, a parte que excede a contratada
 * é cobrada de novo em dobro (ultrapassagem). Conferido na fatura de referência.
 */
export function custoDemandaMes(contratadaKw, medidaKw, tarifaKw) {
  const base = Math.max(medidaKw, contratadaKw) * tarifaKw;
  const ultrapassagem = medidaKw > contratadaKw * TOLERANCIA_ULTRAPASSAGEM ? (medidaKw - contratadaKw) * 2 * tarifaKw : 0;
  return base + ultrapassagem;
}

/**
 * Simula contratos de demanda contra o histórico medido e acha o de menor
 * custo total. Usa a mesma tarifa em todos os meses (comparação entre
 * contratos, não previsão de fatura).
 * @returns {{ curva: {contratoKw, custo}[], atual: {contratoKw, custo}, otimo: {contratoKw, custo}, economia }}
 */
export function simularContratoDemanda(historico, contratoAtualKw, tarifaKw, { chave = "demandaForaPontaKw", passo = 5 } = {}) {
  const medidas = historico.map((h) => h[chave] || 0);
  const custoTotal = (c) => medidas.reduce((s, m) => s + custoDemandaMes(c, m, tarifaKw), 0);
  const max = Math.max(...medidas, contratoAtualKw);
  const inicio = Math.max(passo, Math.floor(Math.min(contratoAtualKw, ...medidas) / passo) * passo);
  const curva = [];
  for (let c = inicio; c <= Math.ceil((max * 1.1) / passo) * passo; c += passo) curva.push({ contratoKw: c, custo: custoTotal(c) });
  const otimo = curva.reduce((a, b) => (b.custo < a.custo ? b : a));
  const atual = { contratoKw: contratoAtualKw, custo: custoTotal(contratoAtualKw) };
  return { curva, atual, otimo, economia: atual.custo - otimo.custo, meses: medidas.length };
}

/**
 * Demanda a contratar para não ter ultrapassagem no histórico: o maior
 * valor medido ÷ 1,05 (a tolerância cobre os 5% acima), arredondado
 * para cima em múltiplos de 5 kW.
 */
export function demandaSugerida(historico, chave = "demandaForaPontaKw") {
  const max = Math.max(...historico.map((h) => h[chave] || 0));
  return Math.ceil(max / TOLERANCIA_ULTRAPASSAGEM / 5) * 5;
}
