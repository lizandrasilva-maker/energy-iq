let mockIndustryData = [
  {
    id: "1",
    name: "Metalúrgica Ferro Forte Ltda",
    contracted_demand: 850,
    current_demand: 905,
    current_consumption: 467000,
    power_factor: 0.84,
    tariff_type: "Verde"
  }
];

let mockBillsData = [
  { id: "1", month: "2026-08", demand_active: 905, demand_contracted: 850, consumption: 467000, power_factor: 0.84, cost: 468000, status: "Excedida" },
  { id: "2", month: "2026-07", demand_active: 830, demand_contracted: 850, consumption: 432000, power_factor: 0.86, cost: 438000, status: "OK" },
  { id: "3", month: "2026-06", demand_active: 875, demand_contracted: 850, consumption: 453000, power_factor: 0.85, cost: 456000, status: "Excedida" },
  { id: "4", month: "2026-05", demand_active: 910, demand_contracted: 850, consumption: 470000, power_factor: 0.83, cost: 472000, status: "Excedida" },
  { id: "5", month: "2026-04", demand_active: 895, demand_contracted: 850, consumption: 461000, power_factor: 0.84, cost: 463000, status: "Excedida" },
  { id: "6", month: "2026-03", demand_active: 860, demand_contracted: 850, consumption: 445000, power_factor: 0.85, cost: 448000, status: "Excedida" },
  { id: "7", month: "2026-02", demand_active: 940, demand_contracted: 850, consumption: 481000, power_factor: 0.81, cost: 482000, status: "Excedida" },
  { id: "8", month: "2026-01", demand_active: 890, demand_contracted: 850, consumption: 468000, power_factor: 0.83, cost: 469000, status: "Excedida" },
  { id: "9", month: "2025-12", demand_active: 920, demand_contracted: 850, consumption: 472000, power_factor: 0.82, cost: 476000, status: "Excedida" },
];

const mockEquipmentsData = [
  { id: "1", name: "Forno de Fusão Indução 1", sector: "Fundição", power: 320, daily_use: 18, monthly_consumption: 4320, status: "Ativo", class: "B" },
  { id: "2", name: "Forno de Fusão Indução 2", sector: "Fundição", power: 280, daily_use: 16, monthly_consumption: 3360, status: "Ativo", class: "C" },
  { id: "3", name: "Laminador Principal", sector: "Laminação", power: 250, daily_use: 20, monthly_consumption: 3750, status: "Ativo", class: "A" },
  { id: "4", name: "Prensa Hidráulica 500T", sector: "Laminação", power: 150, daily_use: 14, monthly_consumption: 1575, status: "Ativo", class: "B" },
  { id: "5", name: "Compressor de Ar Industrial", sector: "Utilidades", power: 180, daily_use: 24, monthly_consumption: 4320, status: "Ativo", class: "C" },
  { id: "6", name: "Ponte Rolante 20T", sector: "Logística", power: 45, daily_use: 10, monthly_consumption: 337, status: "Ativo", class: "A" },
];

/**
 * Injeta os dados lidos pelo Gemini AI diretamente nos arrays mockados.
 */
export const updateIndustryDataFromBill = (billData) => {
  if (!billData) return;

  const measuredDemand = Number(billData.demand_measured) || mockIndustryData[0].current_demand;
  const contractedDemand = Number(billData.demand_contracted) || mockIndustryData[0].contracted_demand;

  // 1. Atualiza a empresa principal
  mockIndustryData[0] = {
    ...mockIndustryData[0],
    name: billData.client_name || mockIndustryData[0].name,
    contracted_demand: contractedDemand,
    current_demand: measuredDemand,
    current_consumption: Number(billData.consumption_total) || mockIndustryData[0].current_consumption,
    power_factor: Number(billData.power_factor) || mockIndustryData[0].power_factor,
  };

  // 2. Insere um novo registo no histórico de faturas
  const newBillRecord = {
    id: String(Date.now()),
    month: billData.reference_month || "2026-09",
    demand_active: measuredDemand,
    demand_contracted: contractedDemand,
    consumption: Number(billData.consumption_total) || 0,
    power_factor: Number(billData.power_factor) || 0.92,
    cost: Number(billData.total_bill_value) || 0,
    status: measuredDemand > contractedDemand ? "Excedida" : "OK"
  };

  mockBillsData = [newBillRecord, ...mockBillsData];
};

const createMockEntity = (entityName) => ({
  list: async () => {
    const lower = entityName.toLowerCase();
    if (lower.includes("industry") || lower.includes("setting") || lower.includes("empresa") || lower.includes("config")) return mockIndustryData;
    if (lower.includes("sensor") || lower.includes("equipment") || lower.includes("equipamento")) return mockEquipmentsData;
    return mockBillsData;
  },
  filter: async () => mockBillsData,
  get: async () => mockIndustryData[0],
  create: async (data) => ({ id: String(Date.now()), ...data }),
  update: async (id, data) => ({ id, ...data }),
  delete: async () => true,
});

const entitiesProxy = new Proxy({}, {
  get: (target, prop) => {
    if (!(prop in target)) {
      target[prop] = createMockEntity(prop);
    }
    return target[prop];
  }
});

export const base44 = {
  entities: entitiesProxy,
  auth: {
    me: async () => ({ id: "1", name: mockIndustryData[0].name, email: "demo@ferroforte.com.br" }),
  },
};

export default base44;