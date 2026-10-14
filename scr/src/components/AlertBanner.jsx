import { AlertTriangle, Info, CheckCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function AlertBanner({ type = "warning", title, message, action, onAction, dismissible = true }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const config = {
    warning: { icon: AlertTriangle, bg: "bg-warning/10 border-warning/30", text: "text-warning", iconColor: "text-warning" },
    danger: { icon: AlertTriangle, bg: "bg-destructive/10 border-destructive/30", text: "text-destructive", iconColor: "text-destructive" },
    info: { icon: Info, bg: "bg-primary/10 border-primary/30", text: "text-primary", iconColor: "text-primary" },
    success: { icon: CheckCircle, bg: "bg-success/10 border-success/30", text: "text-success", iconColor: "text-success" },
  };

  const { icon: Icon, bg, text, iconColor } = config[type];

  return (
    <div className={cn("rounded-xl border p-4 flex items-start gap-3", bg)}>
      <Icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", iconColor)} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold", text)}>{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{message}</p>
        {action && (
          <button
            onClick={onAction}
            className={cn("text-sm font-semibold mt-2 underline underline-offset-2", text)}
          >
            {action}
          </button>
        )}
      </div>
      {dismissible && (
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}