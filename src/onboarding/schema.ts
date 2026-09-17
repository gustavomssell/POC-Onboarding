import { z } from "zod";
import type { FieldConfig, Values } from "./types";
import { onlyDigits, parseBR } from "../lib/utils";

export function isFieldVisible(f: FieldConfig, values: Values): boolean {
  if (!f.showIf) return true;
  const v = values[f.showIf.field];
  const exp = f.showIf.equals;
  if (Array.isArray(v)) return Array.isArray(exp) ? exp.some((e) => v.includes(e)) : v.includes(exp as string);
  return Array.isArray(exp) ? exp.includes(String(v ?? "")) : String(v ?? "") === exp;
}

export function isInputField(f: FieldConfig): boolean {
  return !["heading", "divider", "info"].includes(f.type);
}

function schemaFor(f: FieldConfig): z.ZodType {
  switch (f.type) {
    case "email":
      return z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "E-mail inválido.");
    case "integer":
      return z.string().refine((v) => /^-?\d+$/.test(v.trim()), "Use apenas números inteiros.");
    case "percent":
      return z.string().refine((v) => {
        const n = parseBR(v);
        return n !== null && n >= 0 && n <= 100;
      }, "Use um valor entre 0 e 100.");
    case "currency":
      return z.string().refine((v) => parseBR(v) !== null, "Valor inválido.");
    case "document":
      return z.string().refine((v) => [11, 14].includes(onlyDigits(v).length), "CPF/CNPJ incompleto.");
    case "checkbox":
    case "switch":
      return z.boolean();
    case "chips":
    case "multiselect":
      return z.array(z.string());
    default:
      return z.string();
  }
}

export function validateWithSchema(f: FieldConfig, value: Values[string]): string | null {
  if (!isInputField(f)) return null;
  if (f.type === "checkbox" && f.required && value !== true) return "Confirmação obrigatória.";
  const empty = value === undefined || value === null || value === "" || value === false || (Array.isArray(value) && value.length === 0);
  if (empty) return f.required ? "Campo obrigatório." : null;
  let schema = schemaFor(f);
  if (f.minLength && typeof value === "string") {
    const minLength = f.minLength;
    schema = schema.refine((v) => String(v).length >= minLength, `Mínimo de ${minLength} caracteres.`);
  }
  const result = schema.safeParse(value);
  if (result.success) return null;
  const issue = result.error.issues[0];
  return issue?.code === "invalid_type" ? "Valor inválido." : issue?.message ?? "Valor inválido.";
}

export function validateStepFields(fields: FieldConfig[], values: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (!isFieldVisible(f, values)) continue;
    const message = validateWithSchema(f, values[f.id]);
    if (message) errors[f.id] = message;
  }
  return errors;
}
