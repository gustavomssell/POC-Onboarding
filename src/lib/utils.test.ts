import { describe, expect, it } from "vitest";
import { formatBRL, formatDocument, onlyDigits, parseBR } from "./utils";

describe("máscaras BR", () => {
  it("formatBRL trata centavos", () => {
    expect(formatBRL("")).toBe("");
    expect(formatBRL("1")).toBe("0,01");
    expect(formatBRL("5000000")).toBe("50.000,00");
  });

  it("parseBR entende '1.234,56' e rejeita lixo", () => {
    expect(parseBR("1.234,56")).toBe(1234.56);
    expect(parseBR("")).toBeNull();
    expect(parseBR("abc")).toBeNull();
  });

  it("formatDocument alterna CPF/CNPJ sozinho", () => {
    expect(formatDocument("52998224725")).toBe("529.982.247-25");
    expect(formatDocument("12345678000199")).toBe("12.345.678/0001-99");
    expect(onlyDigits("12.345.678/0001-99")).toHaveLength(14);
  });
});
