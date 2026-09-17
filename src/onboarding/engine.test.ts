import { describe, expect, it } from "vitest";
import { findCycle, isFieldVisible, resolveNextId, validateField } from "./engine";
import { validateWithSchema } from "./schema";
import type { FieldConfig, OnboardingConfig, StepEdge, Values } from "./types";

const txt = (over: Partial<FieldConfig> = {}): FieldConfig =>
  ({ id: "f", type: "text", label: "F", desktopSpan: 12, ...over }) as FieldConfig;

const steps = (ids: string[]): OnboardingConfig["steps"] =>
  ids.map((id) => ({ id, title: id, desktopColumns: 1 as const, fields: [] }));

describe("isFieldVisible", () => {
  it("sempre visível sem showIf", () => {
    expect(isFieldVisible(txt(), { a: "x" })).toBe(true);
  });

  it("bate com valor único", () => {
    const f = txt({ showIf: { field: "kind", equals: "pj" } });
    expect(isFieldVisible(f, { kind: "pj" })).toBe(true);
    expect(isFieldVisible(f, { kind: "pf" })).toBe(false);
    expect(isFieldVisible(f, {})).toBe(false);
  });

  it("bate com lista de valores (campo ou condição multi)", () => {
    const f = txt({ showIf: { field: "kind", equals: ["pj", "coop"] } });
    expect(isFieldVisible(f, { kind: "coop" })).toBe(true);
    expect(isFieldVisible(f, { interests: ["ia", "ux"] } as unknown as Values)).toBe(false);
    const g = txt({ showIf: { field: "interests", equals: "ia" } });
    expect(isFieldVisible(g, { interests: ["ia", "ux"] })).toBe(true);
  });
});

describe("validateField", () => {
  it("obrigatório vazio falha; preenchido passa", () => {
    expect(validateField(txt({ required: true }), "")).toBe("Campo obrigatório.");
    expect(validateField(txt({ required: true }), undefined)).toBe("Campo obrigatório.");
    expect(validateField(txt({ required: true }), "ok")).toBeNull();
  });

  it("checkbox obrigatório exige true", () => {
    const f = txt({ type: "checkbox", required: true });
    expect(validateField(f, false)).toBe("Confirmação obrigatória.");
    expect(validateField(f, true)).toBeNull();
  });

  it("e-mail e minLength", () => {
    const f = txt({ type: "email" });
    expect(validateField(f, "sem-arroba")).toBe("E-mail inválido.");
    expect(validateField(f, "a@b.co")).toBeNull();
    expect(validateField(txt({ minLength: 8 }), "curta")).toBe("Mínimo de 8 caracteres.");
  });

  it("integer rejeita decimal", () => {
    const f = txt({ type: "integer" });
    expect(validateField(f, "10.5")).toBe("Use apenas números inteiros.");
    expect(validateField(f, "10")).toBeNull();
  });

  it("percent só aceita 0–100", () => {
    const f = txt({ type: "percent" });
    expect(validateField(f, "150")).toBe("Use um valor entre 0 e 100.");
    expect(validateField(f, "-5")).toBe("Use um valor entre 0 e 100.");
    expect(validateField(f, "abc")).toBe("Use um valor entre 0 e 100.");
    expect(validateField(f, "75")).toBeNull();
    expect(validateField(f, "0")).toBeNull();
  });

  it("document exige 11 ou 14 dígitos", () => {
    const f = txt({ type: "document" });
    expect(validateField(f, "123.456")).toBe("CPF/CNPJ incompleto.");
    expect(validateField(f, "529.982.247-25")).toBeNull();
    expect(validateField(f, "12.345.678/0001-99")).toBeNull();
  });

  it("currency rejeita texto não numérico", () => {
    const f = txt({ type: "currency" });
    expect(validateField(f, "abc")).toBe("Valor inválido.");
    expect(validateField(f, "1.234,56")).toBeNull();
  });

  it("valida campo condicional quando o chamador determina que está visível", () => {
    const f = txt({ required: true, showIf: { field: "kind", equals: "pj" } });
    expect(validateField(f, "")).toBe("Campo obrigatório.");
  });
});

describe("validateWithSchema (zod)", () => {
  it("espelha as mensagens da validateField", () => {
    const cases: Array<[FieldConfig, Values[string], string | null]> = [
      [txt({ required: true }), "", "Campo obrigatório."],
      [txt({ required: true }), undefined, "Campo obrigatório."],
      [txt({ required: true }), "ok", null],
      [txt({ type: "checkbox", required: true }), false, "Confirmação obrigatória."],
      [txt({ type: "checkbox", required: true }), true, null],
      [txt({ type: "email" }), "sem-arroba", "E-mail inválido."],
      [txt({ type: "email" }), "a@b.co", null],
      [txt({ minLength: 8 }), "curta", "Mínimo de 8 caracteres."],
      [txt({ type: "integer" }), "10.5", "Use apenas números inteiros."],
      [txt({ type: "integer" }), "10", null],
      [txt({ type: "percent" }), "150", "Use um valor entre 0 e 100."],
      [txt({ type: "percent" }), "75", null],
      [txt({ type: "document" }), "123.456", "CPF/CNPJ incompleto."],
      [txt({ type: "document" }), "529.982.247-25", null],
      [txt({ type: "currency" }), "abc", "Valor inválido."],
      [txt({ type: "currency" }), "1.234,56", null],
    ];
    for (const [f, v, expected] of cases) {
      expect(validateWithSchema(f, v), `${f.type}:${String(v)}`).toBe(expected);
    }
  });

  it("REGRESSÃO: checkbox obrigatório marcado passa como boolean", () => {
    const f = txt({ type: "checkbox", required: true });
    expect(validateWithSchema(f, true)).toBeNull();
    expect(validateWithSchema(f, false)).toBe("Confirmação obrigatória.");
  });

  it("REGRESSÃO: chips (array) e switch (boolean) validam pelo tipo", () => {
    expect(validateWithSchema(txt({ type: "chips" }), ["ia", "ux"])).toBeNull();
    expect(validateWithSchema(txt({ type: "switch", required: true }), true)).toBeNull();
  });
});

describe("resolveNextId", () => {
  const s = steps(["a", "b", "c"]);

  it("sem arestas segue o linear; último retorna null", () => {
    expect(resolveNextId("a", {}, s, [])).toBe("b");
    expect(resolveNextId("c", {}, s, [])).toBeNull();
    expect(resolveNextId("a", {}, s, undefined)).toBe("b");
  });

  it("condicional que bate vence a aresta 'sempre'", () => {
    const edges: StepEdge[] = [
      { id: "e1", from: "a", to: "c", when: { field: "kind", equals: "pj" } },
      { id: "e2", from: "a", to: "b" },
    ];
    expect(resolveNextId("a", { kind: "pj" }, s, edges)).toBe("c");
    expect(resolveNextId("a", { kind: "pf" }, s, edges)).toBe("b");
  });

  it("ignora destino inexistente e self-loop (cai no linear)", () => {
    expect(resolveNextId("a", {}, s, [{ id: "e", from: "a", to: "fantasma" }])).toBe("b");
    expect(resolveNextId("a", {}, s, [{ id: "e", from: "a", to: "a" }])).toBe("b");
  });

  it("condição multi-valor (qualquer um ativa)", () => {
    const edges: StepEdge[] = [{ id: "e", from: "a", to: "c", when: { field: "goal", equals: ["x", "y"] } }];
    expect(resolveNextId("a", { goal: "y" }, s, edges)).toBe("c");
    expect(resolveNextId("a", { goal: ["y"] }, s, edges)).toBe("c");
    expect(resolveNextId("a", { goal: "z" }, s, edges)).toBe("b");
  });
});

describe("findCycle", () => {
  it("sem ciclo retorna null", () => {
    const s = steps(["a", "b"]);
    expect(findCycle(s, [{ id: "e", from: "a", to: "b" }])).toBeNull();
    expect(findCycle(s, [])).toBeNull();
  });

  it("detecta ciclo e o caminho", () => {
    const s = steps(["a", "b", "c"]);
    const c = findCycle(s, [
      { id: "e1", from: "a", to: "b" },
      { id: "e2", from: "b", to: "c" },
      { id: "e3", from: "c", to: "a" },
    ]);
    expect(c).toEqual(["a", "b", "c", "a"]);
  });
});
