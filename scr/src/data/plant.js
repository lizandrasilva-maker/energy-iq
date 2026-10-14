// Planta de exemplo: setores e equipamentos, com o vínculo de cada
// equipamento ao seu sensor (sensorId = sensor_id gravado pelo firmware).
// O vínculo fica no código, por decisão da equipe. Compartilhado pelas
// telas Sensores e Reativo.

export const initialSectors = ["Escritório Técnico", "Usinagem", "Processos Térmicos"];

// Equipamentos de exemplo. Os valores elétricos são substituídos pelas
// leituras reais quando o sensor (sensorId) envia dados.
export const initialEquipments = [
  {
    id: 1,
    name: "Bancada de TI & Iluminação",
    sector: "Escritório Técnico",
    class: "A",
    powerKw: 1.2,
    dailyHours: 10,
    status: "Ativo",
    voltage: 220,
    current: 5.4,
    pf: 0.90,
    loadType: "Eletrônica / Não Linear",
    sensorId: "ESP32_PZEM_01",
  },
  {
    id: 2,
    name: "Bomba de Refrigeração",
    sector: "Usinagem",
    class: "B",
    powerKw: 2.2,
    dailyHours: 16,
    status: "Ativo",
    voltage: 220,
    current: 12.5,
    pf: 0.82,
    loadType: "Indutiva (Motor Monofásico)",
    sensorId: "ESP32_PZEM_02",
  },
  {
    id: 3,
    name: "Sistema de Secagem",
    sector: "Processos Térmicos",
    class: "A",
    powerKw: 4.5,
    dailyHours: 12,
    status: "Ativo",
    voltage: 220,
    current: 20.4,
    pf: 0.99,
    loadType: "Resistiva Pura",
    sensorId: "ESP32_PZEM_03",
  },
];
