import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function SectorComparison({ equipment = [], sectors = [] }) {
  const data = sectors.map((sector) => {
    const sectorEquipment = equipment.filter((e) => e.sector === sector);
    const totalConsumption = sectorEquipment.reduce((s, e) => s + (e.current_consumption_kwh || 0), 0);
    const totalPower = sectorEquipment.reduce((s, e) => s + (e.power_kw || 0), 0);
    return {
      sector,
      consumo: Math.round(totalConsumption),
      potencia: Math.round(totalPower),
      equipamentos: sectorEquipment.length,
    };
  }).sort((a, b) => b.consumo - a.consumo);

  if (data.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="font-heading font-semibold text-base mb-1">Comparativo por Setor</h3>
      <p className="text-xs text-muted-foreground mb-4">Consumo mensal estimado por setor (kWh)</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} barSize={32}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="sector" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value) => [`${value.toLocaleString("pt-BR")} kWh`, "Consumo"]}
          />
          <Bar dataKey="consumo" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}