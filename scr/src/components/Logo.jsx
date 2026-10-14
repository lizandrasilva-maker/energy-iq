import { useId } from "react";
import { cn } from "@/lib/utils";

/** Símbolo da EnergyIQ: linha de consumo que termina em um raio. */
export function LogoMark({ className }) {
  const id = useId();
  return (
    <svg viewBox="0 0 130 64" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-line`} x1="0" y1="0" x2="130" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1a8cff" />
          <stop offset="0.55" stopColor="#14c8ec" />
          <stop offset="1" stopColor="#2ee88a" />
        </linearGradient>
        <linearGradient id={`${id}-bolt`} x1="92" y1="60" x2="126" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2ee88a" />
          <stop offset="1" stopColor="#b4f24a" />
        </linearGradient>
      </defs>
      <polyline
        points="5,50 14,50 33,30 51,48 63,36 77,50 101,26"
        stroke={`url(#${id}-line)`}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M119 2 L100 31 L112 31 L94 62 L127 23 L114 23 Z" fill={`url(#${id}-bolt)`} />
    </svg>
  );
}

/** Logo completa: símbolo + "Energy" + "IQ" em verde. */
export default function Logo({ className, markClassName = "h-7", textClassName = "text-xl", stacked = false }) {
  return (
    <span className={cn("inline-flex", stacked ? "flex-col items-start gap-1" : "items-center gap-2.5", className)}>
      <LogoMark className={cn("w-auto shrink-0", markClassName)} />
      <span className={cn("font-heading font-bold leading-none tracking-tight text-white", textClassName)}>
        Energy<span className="text-gradient-brand">IQ</span>
      </span>
    </span>
  );
}
