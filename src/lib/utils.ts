import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

/** Chrome de demonstração (meta de config, path do grafo): só aparece em dev. */
export const SHOW_DEBUG = import.meta.env.DEV;

export function debounce<T extends (...args: never[]) => void>(fn: T, ms = 300) {
  let t: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* ---------- máscaras BR (currency / percent / integer / document) ---------- */

export function onlyDigits(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

/** "123456" → "1.234,56" (centavos). Usado pelo campo monetário. */
export function formatBRL(input: string): string {
  const d = onlyDigits(input).slice(0, 12);
  if (!d) return "";
  return (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "1.234,56" → 1234.56 · null se inválido */
export function parseBR(s: string): number | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** CPF (11 díg.) ↔ CNPJ (14 díg.), alterna sozinho pelo tamanho. */
export function formatDocument(input: string): string {
  const d = onlyDigits(input).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
