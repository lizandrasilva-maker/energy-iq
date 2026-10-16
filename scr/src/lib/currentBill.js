// Fatura em uso no painel: a que o cliente enviou (lida no navegador) ou,
// sem nenhuma, a fatura de referência anonimizada. Todas as telas leem daqui.
// Fica salva só neste navegador (somente números; sem nome nem documento).

import { useSyncExternalStore } from "react";
import { faturaReferencia } from "../data/faturaReferencia.js";

const STORAGE_KEY = "energyiq-fatura-atual";
const listeners = new Set();

function carregar() {
  try {
    const f = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return f && Array.isArray(f.itens) && Array.isArray(f.historico) ? f : null;
  } catch {
    return null;
  }
}

let enviada = carregar();
const avisar = () => listeners.forEach((fn) => fn());

/** Usa a fatura no painel; null volta para a fatura de referência. */
export function setCurrentBill(fatura) {
  enviada = fatura || null;
  try {
    if (enviada) localStorage.setItem(STORAGE_KEY, JSON.stringify(enviada));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // sem armazenamento: vale só até recarregar a página
  }
  avisar();
}

function subscribe(fn) {
  listeners.add(fn);
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) {
      enviada = carregar();
      fn();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

/** { fatura, isReference } da fatura em uso. */
export function useCurrentBill() {
  const f = useSyncExternalStore(subscribe, () => enviada);
  return { fatura: f || faturaReferencia, isReference: !f };
}

export const mesBR = (aaaaMm) => (aaaaMm ? aaaaMm.split("-").reverse().join("/") : "—");
