import { Cpu, Zap, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const statusColors = {
  Ativo: "bg-success/10 text-success",
  Inativo: "bg-muted text-muted-foreground",
  "Manutenção": "bg-warning/10 text-warning",
};

const efficiencyColors = {
  A: "bg-success text-success-foreground",
  B: "bg-success/70 text-success-foreground",
  C: "bg-warning text-warning-foreground",
  D: "bg-destructive/70 text-destructive-foreground",
  E: "bg-destructive text-destructive-foreground",
};

export default function EquipmentCard({ equipment }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Cpu className="w-[18px] h-[18px] text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">{equipment.name}</h4>
            <p className="text-xs text-muted-foreground">{equipment.sector}</p>
          </div>
        </div>
        {equipment.efficiency_rating && (
          <span className={cn("text-xs font-bold w-6 h-6 rounded flex items-center justify-center", efficiencyColors[equipment.efficiency_rating])}>
            {equipment.efficiency_rating}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Potência</span>
          <span className="font-medium">{equipment.power_kw} kW</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Uso diário</span>
          <span className="font-medium">{equipment.daily_usage_hours}h</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Consumo/mês</span>
          <span className="font-medium">{Math.round(equipment.current_consumption_kwh || 0).toLocaleString("pt-BR")} kWh</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", statusColors[equipment.status])}>
          {equipment.status}
        </span>
      </div>
    </div>
  );
}