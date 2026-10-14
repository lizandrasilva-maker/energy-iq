import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Sun, Zap, TrendingDown, DollarSign, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatCard from "../components/StatCard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function MarketSimulation() {
  const [loading, setLoading] = useState(true);

  // Free market form
  const [freeMarket, setFreeMarket] = useState({
    current_tariff: "0.85",
    free_market_tariff: "0.55",
    monthly_consumption: "",
    distribution_tariff: "0.15",
    ccee_fee: "500",
  });
  const [freeResult, setFreeResult] = useState(null);

  // Solar form
  const [solar, setSolar] = useState({
    monthly_consumption: "",
    roof_area_m2: "",
    solar_irradiation: "5.5",
    panel_efficiency: "0.20",
    system_cost_per_kwp: "5000",
    electricity_tariff: "0.85",
  });
  const [solarResult, setSolarResult] = useState(null);

  useEffect(() => {
    async function load() {
      const allReadings = await base44.entities.EnergyReading.list("-month", 12);

      if (allReadings.length > 0) {
        const avgConsumption = Math.round(
          allReadings.reduce((s, r) => s + (r.consumption_kwh || 0), 0) / allReadings.length
        );
        setFreeMarket((prev) => ({ ...prev, monthly_consumption: String(avgConsumption) }));
        setSolar((prev) => ({ ...prev, monthly_consumption: String(avgConsumption) }));
      }
      setLoading(false);
    }
    load();
  }, []);

  function simulateFreeMarket() {
    const consumption = parseFloat(freeMarket.monthly_consumption);
    const currentTariff = parseFloat(freeMarket.current_tariff);
    const fmTariff = parseFloat(freeMarket.free_market_tariff);
    const distTariff = parseFloat(freeMarket.distribution_tariff);
    const cceeFee = parseFloat(freeMarket.ccee_fee);

    const currentCost = consumption * currentTariff;
    const fmCost = consumption * fmTariff + consumption * distTariff + cceeFee;
    const monthlySavings = currentCost - fmCost;
    const annualSavings = monthlySavings * 12;
    const savingsPercent = Math.round((monthlySavings / currentCost) * 100);

    const comparison = Array.from({ length: 12 }, (_, i) => ({
      month: `Mês ${i + 1}`,
      cativo: Math.round(currentCost),
      livre: Math.round(fmCost),
    }));

    setFreeResult({ currentCost: Math.round(currentCost), fmCost: Math.round(fmCost), monthlySavings: Math.round(monthlySavings), annualSavings: Math.round(annualSavings), savingsPercent, comparison });
  }

  function simulateSolar() {
    const consumption = parseFloat(solar.monthly_consumption);
    const roofArea = parseFloat(solar.roof_area_m2);
    const irradiation = parseFloat(solar.solar_irradiation);
    const efficiency = parseFloat(solar.panel_efficiency);
    const costPerKwp = parseFloat(solar.system_cost_per_kwp);
    const tariff = parseFloat(solar.electricity_tariff);

    const systemPowerKwp = (roofArea * efficiency * irradiation) / irradiation;
    const monthlyGeneration = systemPowerKwp * irradiation * 30 * 0.8;
    const coveragePercent = Math.min(100, Math.round((monthlyGeneration / consumption) * 100));
    const monthlySavings = Math.min(monthlyGeneration, consumption) * tariff;
    const annualSavings = monthlySavings * 12;
    const systemCost = systemPowerKwp * costPerKwp;
    const paybackYears = Math.round((systemCost / annualSavings) * 10) / 10;

    setSolarResult({
      systemPowerKwp: Math.round(systemPowerKwp * 10) / 10,
      monthlyGeneration: Math.round(monthlyGeneration),
      coveragePercent,
      monthlySavings: Math.round(monthlySavings),
      annualSavings: Math.round(annualSavings),
      systemCost: Math.round(systemCost),
      paybackYears,
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold tracking-tight">Simulação de Economia</h1>
        <p className="text-muted-foreground mt-1">Compare mercado livre de energia e energia solar</p>
      </div>

      <Tabs defaultValue="free-market" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="free-market" className="gap-2"><Zap className="w-4 h-4" /> Mercado Livre</TabsTrigger>
          <TabsTrigger value="solar" className="gap-2"><Sun className="w-4 h-4" /> Energia Solar</TabsTrigger>
        </TabsList>

        {/* Free Market */}
        <TabsContent value="free-market" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-primary" />
                <h3 className="font-heading font-semibold">Dados para Simulação</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Consumo Mensal Médio (kWh)</Label>
                  <Input type="number" value={freeMarket.monthly_consumption} onChange={(e) => setFreeMarket({ ...freeMarket, monthly_consumption: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tarifa Cativo (R$/kWh)</Label>
                    <Input type="number" step="0.01" value={freeMarket.current_tariff} onChange={(e) => setFreeMarket({ ...freeMarket, current_tariff: e.target.value })} />
                  </div>
                  <div>
                    <Label>Tarifa Livre (R$/kWh)</Label>
                    <Input type="number" step="0.01" value={freeMarket.free_market_tariff} onChange={(e) => setFreeMarket({ ...freeMarket, free_market_tariff: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tarifa Distribuição (R$/kWh)</Label>
                    <Input type="number" step="0.01" value={freeMarket.distribution_tariff} onChange={(e) => setFreeMarket({ ...freeMarket, distribution_tariff: e.target.value })} />
                  </div>
                  <div>
                    <Label>Taxa CCEE (R$/mês)</Label>
                    <Input type="number" value={freeMarket.ccee_fee} onChange={(e) => setFreeMarket({ ...freeMarket, ccee_fee: e.target.value })} />
                  </div>
                </div>
                <Button onClick={simulateFreeMarket} className="w-full gap-2">
                  <Calculator className="w-4 h-4" /> Simular Mercado Livre
                </Button>
              </div>
            </div>

            {freeResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard title="Custo Cativo/mês" value={`R$ ${freeResult.currentCost.toLocaleString("pt-BR")}`} icon={DollarSign} variant="destructive" />
                  <StatCard title="Custo Livre/mês" value={`R$ ${freeResult.fmCost.toLocaleString("pt-BR")}`} icon={DollarSign} variant="success" />
                  <StatCard title="Economia Mensal" value={`R$ ${freeResult.monthlySavings.toLocaleString("pt-BR")}`} icon={TrendingDown} variant="success" />
                  <StatCard title="Economia Anual" value={`R$ ${freeResult.annualSavings.toLocaleString("pt-BR")}`} icon={TrendingDown} variant="primary" />
                </div>
                <div className="bg-card border border-border rounded-xl p-5">
                  <h4 className="font-heading font-semibold text-sm mb-1">Comparativo Anual</h4>
                  <p className="text-xs text-muted-foreground mb-4">Economia de {freeResult.savingsPercent}% com mercado livre</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={freeResult.comparison} barSize={16}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                      <Legend />
                      <Bar dataKey="cativo" name="Mercado Cativo" fill="hsl(var(--chart-5))" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="livre" name="Mercado Livre" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Preencha os dados para ver a simulação</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Solar */}
        <TabsContent value="solar" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sun className="w-5 h-5 text-accent" />
                <h3 className="font-heading font-semibold">Dados para Simulação Solar</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Consumo Mensal Médio (kWh)</Label>
                  <Input type="number" value={solar.monthly_consumption} onChange={(e) => setSolar({ ...solar, monthly_consumption: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Área Disponível (m²)</Label>
                    <Input type="number" value={solar.roof_area_m2} onChange={(e) => setSolar({ ...solar, roof_area_m2: e.target.value })} placeholder="Ex: 500" />
                  </div>
                  <div>
                    <Label>Irradiação Solar (kWh/m²/dia)</Label>
                    <Input type="number" step="0.1" value={solar.solar_irradiation} onChange={(e) => setSolar({ ...solar, solar_irradiation: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Custo por kWp (R$)</Label>
                    <Input type="number" value={solar.system_cost_per_kwp} onChange={(e) => setSolar({ ...solar, system_cost_per_kwp: e.target.value })} />
                  </div>
                  <div>
                    <Label>Tarifa Atual (R$/kWh)</Label>
                    <Input type="number" step="0.01" value={solar.electricity_tariff} onChange={(e) => setSolar({ ...solar, electricity_tariff: e.target.value })} />
                  </div>
                </div>
                <Button onClick={simulateSolar} className="w-full gap-2">
                  <Calculator className="w-4 h-4" /> Simular Energia Solar
                </Button>
              </div>
            </div>

            {solarResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard title="Potência do Sistema" value={`${solarResult.systemPowerKwp}`} unit="kWp" icon={Sun} variant="primary" />
                  <StatCard title="Geração Mensal" value={solarResult.monthlyGeneration.toLocaleString("pt-BR")} unit="kWh" icon={Zap} variant="success" />
                  <StatCard title="Cobertura" value={`${solarResult.coveragePercent}%`} icon={TrendingDown} variant={solarResult.coveragePercent >= 80 ? "success" : "warning"} />
                  <StatCard title="Payback" value={`${solarResult.paybackYears}`} unit="anos" icon={DollarSign} variant="default" />
                </div>
                <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                  <h4 className="font-heading font-semibold text-sm">Resumo Financeiro</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Investimento Total:</span><span className="font-semibold">R$ {solarResult.systemCost.toLocaleString("pt-BR")}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Economia Mensal:</span><span className="font-semibold text-success">R$ {solarResult.monthlySavings.toLocaleString("pt-BR")}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Economia Anual:</span><span className="font-semibold text-success">R$ {solarResult.annualSavings.toLocaleString("pt-BR")}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Economia em 25 anos:</span><span className="font-bold text-primary">R$ {(solarResult.annualSavings * 25).toLocaleString("pt-BR")}</span></div>
                  </div>
                  <div className="mt-4 bg-primary/5 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">O retorno do investimento ocorre em aproximadamente <strong className="text-primary">{solarResult.paybackYears} anos</strong>. Painéis solares possuem vida útil de 25+ anos.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Sun className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Preencha os dados para ver a simulação</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}