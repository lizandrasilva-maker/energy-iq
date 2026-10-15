import { useId, useState } from "react";
import { HelpCircle } from "lucide-react";

/**
 * Explicação curta de um termo técnico, para o cliente que não é
 * especialista. Abre ao passar o mouse, ao focar com o teclado ou ao tocar.
 *
 * <InfoTip>Energia reativa é a que circula sem virar trabalho…</InfoTip>
 */
export default function InfoTip({ children, label = "O que é isso?" }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="p-0.5 rounded-full text-slate-400 hover:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 cursor-help"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 bottom-full z-30 mb-2 w-64 max-w-[80vw] -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-normal normal-case tracking-normal leading-relaxed text-slate-600 shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
}
