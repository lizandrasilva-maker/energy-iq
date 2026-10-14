import { cn } from "@/lib/utils";

export default function StatCard({ title, value, unit, icon: Icon, trend, trendLabel, variant = "default", className }) {
  const variants = {
    default: "bg-card border-border",
    primary: "bg-primary/5 border-primary/20",
    success: "bg-success/5 border-success/20",
    warning: "bg-warning/5 border-warning/20",
    destructive: "bg-destructive/5 border-destructive/20",
  };

  return (
    <div className={cn("rounded-xl border p-5 transition-all duration-200 hover:shadow-md", variants[variant], className)}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {Icon && (
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center",
            variant === "primary" && "bg-primary/10 text-primary",
            variant === "success" && "bg-success/10 text-success",
            variant === "warning" && "bg-warning/10 text-warning",
            variant === "destructive" && "bg-destructive/10 text-destructive",
            variant === "default" && "bg-muted text-muted-foreground"
          )}>
            <Icon className="w-[18px] h-[18px]" />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-heading font-bold tracking-tight">{value}</span>
        {unit && <span className="text-sm text-muted-foreground font-medium">{unit}</span>}
      </div>
      {(trend !== undefined || trendLabel) && (
        <div className="flex items-center gap-1.5 mt-2">
          {trend !== undefined && (
            <span className={cn(
              "text-xs font-semibold px-1.5 py-0.5 rounded",
              trend > 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
            )}>
              {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%
            </span>
          )}
          {trendLabel && <span className="text-xs text-muted-foreground">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}