import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export default function DemandChart({ readings, contractedDemand }) {
  const data = [...readings].reverse().map((r) => ({
    month: r.month,
    demanda: r.consumed_demand_kw,
    exceeded: r.demand_exceeded,
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="font-heading font-semibold text-base mb-1">Demanda Mensal</h3>
      <p className="text-xs text-muted-foreground mb-4">Consumida vs Contratada</p>
      {data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          Nenhum dado disponível
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} barSize={24}>
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
              formatter={(value) => [`${value} kW`, "Demanda"]}
            />
            <Bar
              dataKey="demanda"
              fill="hsl(var(--chart-1))"
              radius={[4, 4, 0, 0]}
            />
            {contractedDemand && (
              <ReferenceLine
                y={contractedDemand}
                stroke="hsl(var(--destructive))"
                strokeDasharray="6 3"
                strokeWidth={2}
                label={{ value: `Contratada: ${contractedDemand} kW`, position: "top", fontSize: 11, fill: "hsl(var(--destructive))" }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}