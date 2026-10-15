// Fatura de referência do EnergyIQ: indústria real do Grupo A atendida pela
// Enel CE (A4 Horossazonal Verde), referência 08/2024.
//
// ANONIMIZADA (LGPD): sem nome, CPF/CNPJ, endereço, número da instalação,
// do cliente ou do medidor. O PDF original NÃO fica no repositório.
// Valores transcritos da fatura e conferidos (ver lib/billXray.js e os
// testes): os itens somam exatamente o subtotal e os preços com tributos
// batem com a fórmula tarifa ÷ [(1 − PIS − COFINS) × (1 − ICMS)].

export const faturaReferencia = {
  id: "ref-enelce-a4-2024-08",
  cliente: "Indústria de referência",
  local: "Região metropolitana de Fortaleza – CE",
  distribuidora: "Enel CE",
  subgrupo: "A4",
  modalidade: "Verde",
  classe: "Industrial",
  ligacao: "Trifásica",
  referencia: "2024-08",
  leitura: { anterior: "2024-07-01", atual: "2024-08-01", dias: 31 },
  bandeiras: "Amarela de 02/07 a 31/07; verde em 01/08",

  demandaContratadaKw: 240, // "Grandezas contratadas: demanda fora ponta"

  medicao: {
    energiaForaPontaKwh: 239911,
    energiaPontaKwh: 3532,
    demandaForaPontaKw: 706.44,
    demandaPontaKw: 129.36,
    demandaReativaForaPontaKvar: 684.81,
    demandaReativaPontaKvar: 91.35,
    energiaReativaForaPontaKvarh: 24224,
    energiaReativaPontaKvarh: 405,
  },

  tributos: { icms: 0.2, pis: 0.0048, cofins: 0.0218 },

  // Itens de energia (subtotal faturamento). componente = grupo do raio-x
  itens: [
    { componente: "consumo_fora_ponta", descricao: "Energia ativa fora ponta (TE)", unidade: "kWh", quantidade: 239911, tarifa: 0.25969, precoComTributos: 0.33348, valor: 80006.25 },
    { componente: "consumo_fora_ponta", descricao: "Energia ativa fora ponta (TUSD)", unidade: "kWh", quantidade: 239911, tarifa: 0.0813, precoComTributos: 0.1044, valor: 25047.2 },
    { componente: "consumo_ponta", descricao: "Energia ativa ponta (TE)", unidade: "kWh", quantidade: 3532, tarifa: 0.40766, precoComTributos: 0.52349, valor: 1848.98 },
    { componente: "consumo_ponta", descricao: "Energia ativa ponta (TUSD)", unidade: "kWh", quantidade: 3532, tarifa: 1.17699, precoComTributos: 1.51143, valor: 5338.38 },
    { componente: "bandeira", descricao: "Adicional bandeira amarela", unidade: "kWh", quantidade: 235589, tarifa: 0.01824, precoComTributos: 0.02343, valor: 5702.72 },
    { componente: "reativo", descricao: "Consumo reativo excedente fora ponta", unidade: "kVArh", quantidade: 24224, tarifa: 0.27291, precoComTributos: 0.35046, valor: 8489.51 },
    { componente: "reativo", descricao: "Consumo reativo excedente ponta", unidade: "kVArh", quantidade: 405, tarifa: 0.27291, precoComTributos: 0.3504, valor: 141.91 },
    { componente: "demanda", descricao: "Demanda ativa", unidade: "kW", quantidade: 706.44, tarifa: 22.65, precoComTributos: 29.08615, valor: 20547.62 },
    { componente: "ultrapassagem", descricao: "Demanda de ultrapassagem", unidade: "kW", quantidade: 466.44, tarifa: 45.3, precoComTributos: 58.17233, valor: 27133.9 },
  ],

  // Fora da conta de energia (não entram no raio-x)
  outros: [
    { descricao: "Contribuição de iluminação pública (CIP)", valor: 194.47 },
    { descricao: "Parcelamento de débito anterior (1/7)", valor: 74593.66 },
  ],

  subtotalFaturamento: 174256.47,
  total: 249044.6,
  tributosCobrados: { icms: 34851.27, pis: 669.1, cofins: 3038.99 },

  // Histórico de faturamento impresso na fatura (13 meses)
  historico: [
    { mes: "2023-08", demandaPontaKw: 97.44, demandaForaPontaKw: 512.4, consumoPontaKwh: 2430, consumoForaPontaKwh: 160207, dias: 31 },
    { mes: "2023-09", demandaPontaKw: 105.0, demandaForaPontaKw: 540.96, consumoPontaKwh: 2646, consumoForaPontaKwh: 168647, dias: 31 },
    { mes: "2023-10", demandaPontaKw: 82.32, demandaForaPontaKw: 568.68, consumoPontaKwh: 1879, consumoForaPontaKwh: 168595, dias: 30 },
    { mes: "2023-11", demandaPontaKw: 133.56, demandaForaPontaKw: 661.92, consumoPontaKwh: 3126, consumoForaPontaKwh: 215317, dias: 31 },
    { mes: "2023-12", demandaPontaKw: 115.08, demandaForaPontaKw: 740.04, consumoPontaKwh: 2766, consumoForaPontaKwh: 231981, dias: 30 },
    { mes: "2024-01", demandaPontaKw: 72.24, demandaForaPontaKw: 703.08, consumoPontaKwh: 2162, consumoForaPontaKwh: 197804, dias: 31 },
    { mes: "2024-02", demandaPontaKw: 124.32, demandaForaPontaKw: 643.44, consumoPontaKwh: 2920, consumoForaPontaKwh: 222904, dias: 31 },
    { mes: "2024-03", demandaPontaKw: 134.4, demandaForaPontaKw: 672.84, consumoPontaKwh: 2869, consumoForaPontaKwh: 214592, dias: 29 },
    { mes: "2024-04", demandaPontaKw: 118.44, demandaForaPontaKw: 760.2, consumoPontaKwh: 3201, consumoForaPontaKwh: 257006, dias: 31 },
    { mes: "2024-05", demandaPontaKw: 195.72, demandaForaPontaKw: 716.52, consumoPontaKwh: 3661, consumoForaPontaKwh: 236799, dias: 30 },
    { mes: "2024-06", demandaPontaKw: 143.64, demandaForaPontaKw: 642.6, consumoPontaKwh: 3242, consumoForaPontaKwh: 213777, dias: 31 },
    { mes: "2024-07", demandaPontaKw: 139.44, demandaForaPontaKw: 686.28, consumoPontaKwh: 3228, consumoForaPontaKwh: 220701, dias: 30 },
    { mes: "2024-08", demandaPontaKw: 129.36, demandaForaPontaKw: 706.44, consumoPontaKwh: 3532, consumoForaPontaKwh: 239911, dias: 31 },
  ],
};
