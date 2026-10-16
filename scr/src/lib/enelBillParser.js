// Leitor de faturas da Enel CE do Grupo A por regras (sem IA, sem custo).
//
// Roda no navegador do cliente: a fatura não sai do computador. Lê o texto
// do PDF (pdf.js) e extrai só NÚMEROS — itens da fatura, medição, tributos,
// demanda contratada e histórico. Não extrai nome, CPF/CNPJ nem endereço.
// Confere a soma dos itens com o subtotal impresso.
//
// Outras distribuidoras: tratadas caso a caso (novo leitor).

const MESES = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 };
const NUM = String.raw`-?[\d.]+,\d+-?`; // número pt-BR, com sinal "-" no fim nos créditos

/** "1.234,56" → 1234.56; "745,97-" → -745.97 */
export function numBR(s) {
  if (s == null) return null;
  let t = String(s).trim();
  const neg = t.endsWith("-") || t.startsWith("-");
  t = t.replace(/-/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/**
 * Agrupa os itens de texto do pdf.js em linhas (mesma altura), da esquerda
 * para a direita, separados por " | ". Devolve também o texto corrido.
 */
export function linesFromItems(items) {
  const rows = new Map();
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = Math.round(it.transform[5]);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push({ x: it.transform[4], s: it.str.trim() });
  }
  const lines = [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, its]) => its.sort((a, b) => a.x - b.x).map((i) => i.s).join(" | "));
  const text = items.map((i) => i.str).join(" ").replace(/\s+/g, " ");
  return { lines, text };
}

/** Linhas de várias páginas (cada página agrupada separadamente). */
export function linesFromPages(pages) {
  const all = pages.map(linesFromItems);
  return { lines: all.flatMap((p) => p.lines), text: all.map((p) => p.text).join(" ") };
}

/** Classifica um item da fatura no componente do raio-x. */
export function componenteDoItem(descricao) {
  const d = descricao.toLowerCase();
  if (/inj|compens|ouc|\bgd\b|cr[eé]dito/.test(d)) return "compensacao";
  if (/band/.test(d)) return "bandeira";
  if (/ultrapassagem/.test(d)) return "ultrapassagem";
  if (/reativ/.test(d)) return "reativo";
  if (/demanda/.test(d)) return "demanda";
  if (/forn\s+f\s+ponta|fora\s+ponta|\bf\s*p\b/.test(d)) return "consumo_fora_ponta";
  if (/forn\s+ponta|\bponta\b/.test(d)) return "consumo_ponta";
  return "outros";
}

/** Descrição legível para o cliente (a original fica em descricaoFatura). */
export function descricaoLegivel(componente, descricao) {
  const d = descricao.toLowerCase();
  const parcela = /tusd/.test(d) ? " (TUSD)" : /\bte\b/.test(d) ? " (TE)" : "";
  const fp = /\bf\s*ponta|fora\s+ponta|\bfp\b/.test(d);
  switch (componente) {
    case "consumo_fora_ponta": return `Energia ativa fora ponta${parcela}`;
    case "consumo_ponta": return `Energia ativa ponta${parcela}`;
    case "bandeira": {
      const cor = d.match(/amarela|vermelha(?:\s+p(?:at)?\.?\s*\d)?|verde|escassez/);
      return `Adicional bandeira ${cor ? cor[0] : ""}`.trim();
    }
    case "reativo":
      return /demanda/.test(d) ? "Demanda reativa excedente" : `Consumo reativo excedente ${fp ? "fora ponta" : "ponta"}`;
    case "demanda":
      return /ponta/.test(d) ? `Demanda ativa ${fp ? "fora ponta" : "ponta"}` : "Demanda ativa";
    case "ultrapassagem":
      return /ponta/.test(d) ? `Demanda de ultrapassagem ${fp ? "fora ponta" : "ponta"}` : "Demanda de ultrapassagem";
    case "compensacao": {
      // "Energ Atv Inj FP TE oUC 02/2025 mPT": gerada fora ponta em outra unidade, no mês 02/2025
      const mes = descricao.match(/\d{2}\/\d{4}/);
      return `Crédito de geração${/ouc/.test(d) ? " de outra unidade" : ""}${mes ? ` (${mes[0]})` : ""}${parcela}`;
    }
    default: return descricao;
  }
}

const ITEM_RE = new RegExp(
  String.raw`(?:^|\|\s*)([^|]*?[A-Za-zÀ-ú][^|]*?)\s*\|\s*(kWh|kW|kVArh|kVA)\s*\|\s*(${NUM})\s*\|\s*(${NUM})\s*\|\s*(${NUM})\s*\|\s*(${NUM})\s*\|\s*(${NUM})\s*\|\s*([\d,]+%)\s*\|\s*(${NUM})\s*\|\s*(${NUM})`,
  "g"
);
const MED_RE = new RegExp(
  String.raw`(Energia Ativa-kWh|Demanda Faturada-kW|Demanda Reativa-kVAr|Energia Reativa-kVArh)\s*\|\s*(FORA PONTA|PONTA)\s*\|\s*(${NUM})\s*\|\s*(${NUM})\s*\|\s*([\d.,]+)\s*\|\s*(${NUM})`,
  "g"
);
const HIST_RE = new RegExp(
  String.raw`\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s*\/\s*(\d{4})\s*\|\s*(${NUM})\s*\|\s*(${NUM})\s*\|\s*(${NUM})\s*\|\s*(${NUM})\s*\|\s*(\d{1,2})\b`
);

const MED_CHAVE = {
  "Energia Ativa-kWh|FORA PONTA": "energiaForaPontaKwh",
  "Energia Ativa-kWh|PONTA": "energiaPontaKwh",
  "Demanda Faturada-kW|FORA PONTA": "demandaForaPontaKw",
  "Demanda Faturada-kW|PONTA": "demandaPontaKw",
  "Demanda Reativa-kVAr|FORA PONTA": "demandaReativaForaPontaKvar",
  "Demanda Reativa-kVAr|PONTA": "demandaReativaPontaKvar",
  "Energia Reativa-kVArh|FORA PONTA": "energiaReativaForaPontaKvarh",
  "Energia Reativa-kVArh|PONTA": "energiaReativaPontaKvarh",
};

/**
 * Lê a fatura. Devolve { ok: true, fatura, avisos } no mesmo formato da
 * fatura de referência (src/data/faturaReferencia.js), ou { ok: false, motivo }.
 */
export function parseEnelBill({ lines, text }) {
  const avisos = [];
  const tudo = text || lines.join(" ");

  if (!/enel|companhia energ[eé]tica do cear/i.test(tudo)) {
    return { ok: false, motivo: "Esta fatura não parece ser da Enel Ceará. Outras distribuidoras são tratadas caso a caso." };
  }
  const grupo = tudo.match(/\b(A[1-4]|AS)\s+(HOROSAZONAL|HOR[ÁA]RI[OA])\s+(VERDE|AZUL)\b/i);
  if (!grupo) {
    const b = tudo.match(/\bB[1-4]\b/);
    return {
      ok: false,
      motivo: b
        ? `Fatura do Grupo B (${b[0]}). O EnergyIQ analisa faturas do Grupo A (média e alta tensão).`
        : "Não encontrei o subgrupo e a modalidade tarifária (ex.: A4 Horossazonal Verde).",
    };
  }
  const subgrupo = grupo[1].toUpperCase();
  const modalidade = grupo[3][0].toUpperCase() + grupo[3].slice(1).toLowerCase();

  // Itens da fatura
  const itens = [];
  for (const line of lines) {
    for (const m of line.matchAll(ITEM_RE)) {
      const descricaoFatura = m[1].replace(/\s+/g, " ").trim();
      const componente = componenteDoItem(descricaoFatura);
      itens.push({
        componente,
        descricao: descricaoLegivel(componente, descricaoFatura),
        descricaoFatura,
        unidade: m[2],
        quantidade: numBR(m[3]),
        precoComTributos: numBR(m[4]),
        valor: numBR(m[5]),
        tarifa: numBR(m[10]),
      });
    }
  }
  if (!itens.length) return { ok: false, motivo: "Não consegui ler os itens da fatura. O PDF pode ser uma imagem (digitalizado)." };
  if (itens.some((i) => i.componente === "outros")) {
    avisos.push(`Itens não classificados: ${itens.filter((i) => i.componente === "outros").map((i) => i.descricao).join("; ")}.`);
  }

  // Medição
  const medicao = {};
  for (const line of lines) {
    for (const m of line.matchAll(MED_RE)) {
      const k = MED_CHAVE[`${m[1]}|${m[2]}`];
      if (k) medicao[k] = numBR(m[6]);
    }
  }

  // Demanda contratada (Verde: fora ponta; Azul: ponta e fora ponta)
  const contrFP = tudo.match(/DEMANDA FORA PONTA\s*-\s*KW\s*\|?\s*([\d.]+,\d+)/i);
  const contrP = tudo.match(/DEMANDA PONTA\s*-\s*KW\s*\|?\s*([\d.]+,\d+)/i);
  const demandaContratadaKw = contrFP ? numBR(contrFP[1]) : null;
  if (demandaContratadaKw == null) avisos.push("Demanda contratada não encontrada.");

  // Tributos (alíquotas em %)
  const trib = (nome) => {
    const m = tudo.match(new RegExp(String.raw`${nome}\s*\|?\s*[\d.]+,\d+\s*\|?\s*([\d,]+)\s*\|?\s*[\d.]+,\d+`, "i"));
    return m ? numBR(m[1]) / 100 : null;
  };
  const tributos = { icms: trib("ICMS"), pis: trib("PIS\\/PASEP"), cofins: trib("COFINS") };
  if (Object.values(tributos).some((v) => v == null)) avisos.push("Alíquotas de tributos incompletas.");

  // Referência, vencimento, total e leitura
  const refM = tudo.match(/\b(\d{2})\/(\d{4})\s+\d{2}\/\d{2}\/\d{4}\s+R\$\s*([\d.]+,\d{2})/);
  const referencia = refM ? `${refM[2]}-${refM[1]}` : null;
  const total = refM ? numBR(refM[3]) : null;
  const leitM = tudo.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2})\s+\d{2}\/\d{2}\/\d{4}/);
  const leitura = leitM
    ? { anterior: `${leitM[3]}-${leitM[2]}-${leitM[1]}`, atual: `${leitM[6]}-${leitM[5]}-${leitM[4]}`, dias: Number(leitM[7]) }
    : null;
  const bandM = tudo.match(/Band\.\s*Tarif\.\s*:\s*(.+?)(?:\s+Bandeira\b|\s+Informa|\s+A Enel|\|)/);

  // Subtotal impresso; sem ele, a soma dos itens
  const subM = tudo.match(/Subtotal Faturamento\s*\|?\s*([\d.]+,\d{2})/);
  const soma = itens.reduce((t, i) => t + i.valor, 0);
  const subtotalFaturamento = subM ? numBR(subM[1]) : Math.round(soma * 100) / 100;
  if (!subM) avisos.push("Subtotal não encontrado no PDF; usada a soma dos itens.");

  // Histórico (13 meses)
  const historico = [];
  for (const line of lines) {
    const m = line.match(HIST_RE);
    if (!m) continue;
    historico.push({
      mes: `${m[2]}-${String(MESES[m[1]]).padStart(2, "0")}`,
      demandaPontaKw: numBR(m[3]),
      demandaForaPontaKw: numBR(m[4]),
      consumoPontaKwh: numBR(m[5]),
      consumoForaPontaKwh: numBR(m[6]),
      dias: Number(m[7]),
    });
  }
  historico.sort((a, b) => a.mes.localeCompare(b.mes));
  if (historico.length < 3) avisos.push("Histórico de faturamento curto ou não encontrado.");

  const fatura = {
    id: `pdf-enelce-${(referencia || "sem-data")}`,
    cliente: "Sua empresa",
    distribuidora: "Enel CE",
    subgrupo,
    modalidade,
    referencia,
    leitura,
    bandeiras: bandM ? bandM[1].trim() : null,
    demandaContratadaKw,
    demandaContratadaPontaKw: contrP ? numBR(contrP[1]) : null,
    medicao,
    tributos,
    itens,
    outros: total != null && subtotalFaturamento != null && total - subtotalFaturamento > 0.01
      ? [{ descricao: "Outros valores fora da conta de energia (iluminação pública, parcelamentos etc.)", valor: Math.round((total - subtotalFaturamento) * 100) / 100 }]
      : [],
    subtotalFaturamento,
    total,
    historico,
    fonte: "Leitura automática do PDF (regras Enel CE)",
  };
  if (modalidade === "Azul") avisos.push("Modalidade Azul: as simulações de demanda ainda consideram só a demanda fora de ponta.");
  return { ok: true, fatura, avisos, faltando: faltandoParaPainel(fatura) };
}

/**
 * O que falta para a fatura alimentar o painel (todas as telas usam estes
 * dados). Lista vazia = pode aplicar.
 */
export function faltandoParaPainel(f) {
  const tem = (c, re) => f.itens.some((i) => i.componente === c && (!re || re.test(i.descricao)));
  const falta = [];
  if (!f.referencia) falta.push("mês de referência");
  if (!(f.demandaContratadaKw > 0)) falta.push("demanda contratada");
  if (!(f.medicao.demandaForaPontaKw > 0)) falta.push("demanda medida");
  if (!(f.medicao.energiaForaPontaKwh > 0)) falta.push("energia medida");
  if (!tem("demanda")) falta.push("item de demanda");
  if (!tem("consumo_fora_ponta", /\(TE\)/)) falta.push("item de energia fora ponta (TE)");
  if (!f.historico.length) falta.push("histórico de faturamento");
  return falta;
}
