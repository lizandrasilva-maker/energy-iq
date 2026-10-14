import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function ConsumptionOverview({ readings }) {
  const data = [...readings].reverse().map((r) => ({
    month: r.month,
    consumo: r.consumption_kwh,
    ponta: r.peak_consumption_kwh || 0,
    foraPonta: r.offpeak_consumption_kwh || 0,
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="font-heading font-semibold text-base mb-1">Consumo de Energia</h3>
      <p className="text-xs text-muted-foreground mb-4">Total mensal (kWh)</p>
      {data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          Nenhum dado disponível
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Area
              type="monotone"
              dataKey="consumo"
              stroke="hsl(var(--chart-2))"
              fill="hsl(var(--chart-2))"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}