import * as React from "react"

export function Dialog({ open, onOpenChange, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-lg bg-background p-6 shadow-lg rounded-xl border border-border">
        <button 
          onClick={() => onOpenChange(false)} 
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogTrigger({ children, ...props }) {
  return React.cloneElement(children, props);
}

export function DialogContent({ children, className }) {
  return <div className={className}>{children}</div>;
}

export function DialogHeader({ children }) {
  return <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-4">{children}</div>;
}

export function DialogTitle({ children, className }) {
  return <h2 className={`text-lg font-semibold leading-none tracking-tight ${className || ''}`}>{children}</h2>;
}