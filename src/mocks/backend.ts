import { z } from "zod";
import type { OnboardingConfig, Values } from "../onboarding/types";
import { uid } from "../lib/utils";
import { seedOnboardings } from "./seed";

const LS_CONFIG = "poc-onboarding-config";
const LS_DRAFT = "poc-onboarding-draft";
const LS_COLLECTION = "poc-onboardings";
const LEGACY_ID = "onboarding-poc-v1";

const wait = (ms = 50) => new Promise((r) => setTimeout(r, ms));
const valueSchema = z.union([z.string(), z.boolean(), z.array(z.string()), z.undefined()]);
const valuesSchema = z.record(z.string(), valueSchema);
const conditionSchema = z.looseObject({
  field: z.string(),
  equals: z.union([z.string(), z.array(z.string())]),
});
const configSchema: z.ZodType<OnboardingConfig> = z.looseObject({
  id: z.string().min(1),
  version: z.number(),
  title: z.string(),
  steps: z.array(z.looseObject({
    id: z.string().min(1),
    title: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    desktopColumns: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    skippable: z.boolean().optional(),
    fields: z.array(z.looseObject({
      id: z.string().min(1),
      type: z.enum(["text", "email", "password", "tel", "number", "integer", "currency", "percent", "document", "date", "textarea", "select", "radio", "buttons", "checkbox", "multiselect", "switch", "chips", "heading", "divider", "info"]),
      label: z.string(),
      placeholder: z.string().optional(),
      help: z.string().optional(),
      required: z.boolean().optional(),
      options: z.array(z.looseObject({ value: z.string(), label: z.string() })).optional(),
      defaultValue: valueSchema.optional(),
      desktopSpan: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(12)]).optional(),
      showIf: conditionSchema.optional(),
      minLength: z.number().optional(),
      content: z.string().optional(),
      headingLevel: z.enum(["title", "subtitle"]).optional(),
    })),
  })),
  edges: z.array(z.looseObject({
    id: z.string(),
    from: z.string(),
    to: z.string(),
    when: conditionSchema.optional(),
  })).optional(),
  positions: z.record(z.string(), z.looseObject({ x: z.number(), y: z.number() })).optional(),
});
const collectionSchema = z.array(configSchema).refine((configs) => new Set(configs.map((cfg) => cfg.id)).size === configs.length);
const titleSchema = z.string().trim().min(1, "Informe um título.").max(120, "O título deve ter no máximo 120 caracteres.");

function readCollection(): OnboardingConfig[] {
  const raw = localStorage.getItem(LS_COLLECTION);
  if (raw !== null) return collectionSchema.parse(JSON.parse(raw));
  const legacy = localStorage.getItem(LS_CONFIG);
  const config = legacy === null ? defaultConfig() : configSchema.parse(JSON.parse(legacy));
  const draft = localStorage.getItem(LS_DRAFT);
  let migratedDraft: Values | undefined;
  if (draft !== null && localStorage.getItem(draftKey(config.id)) === null) {
    try {
      migratedDraft = valuesSchema.parse(JSON.parse(draft));
    } catch {
      migratedDraft = undefined;
    }
  }
  if (migratedDraft !== undefined) localStorage.setItem(draftKey(config.id), JSON.stringify(migratedDraft));
  writeCollection([config]);
  if (migratedDraft !== undefined) localStorage.removeItem(LS_DRAFT);
  return [config];
}

function writeCollection(configs: OnboardingConfig[]): void {
  localStorage.setItem(LS_COLLECTION, JSON.stringify(configs));
}

export function initSeededCollection(): void {
  if (localStorage.getItem(LS_COLLECTION) !== null) return;
  if (localStorage.getItem(LS_CONFIG) !== null) return;
  writeCollection(seedOnboardings);
}

function requireConfig(configs: OnboardingConfig[], id: string): OnboardingConfig {
  const config = configs.find((cfg) => cfg.id === id);
  if (!config) throw new Error(`Onboarding não encontrado (not found): ${id}`);
  return config;
}

function draftKey(id: string): string {
  return `${LS_DRAFT}:${id}`;
}

export function defaultConfig(): OnboardingConfig {
  return {
    id: LEGACY_ID,
    version: 1,
    title: "Crie sua conta",
    steps: [
      {
        id: "welcome",
        title: "Boas-vindas",
        description: "Para começar, nos diga quem você é.",
        desktopColumns: 1,
        fields: [
          {
            id: "account_kind",
            type: "buttons",
            label: "Você é",
            required: true,
            desktopSpan: 12,
            options: [
              { value: "pf", label: "Pessoa física" },
              { value: "pj", label: "Empresa (PJ)" },
            ],
          },
        ],
      },
      {
        id: "account",
        title: "Conta",
        description: "Dados básicos de acesso.",
        desktopColumns: 2,
        fields: [
          { id: "account_head", type: "heading", label: "Dados básicos", content: "Usados para criar seu acesso.", desktopSpan: 12 },
          { id: "name", type: "text", label: "Nome completo", placeholder: "Ex.: Maria Silva", required: true, desktopSpan: 6 },
          { id: "email", type: "email", label: "E-mail", placeholder: "voce@empresa.com", required: true, desktopSpan: 6 },
          { id: "password", type: "password", label: "Senha", placeholder: "Mín. 8 caracteres", required: true, minLength: 8, desktopSpan: 6 },
          { id: "phone", type: "tel", label: "Celular / WhatsApp", placeholder: "(11) 99999-9999", required: true, desktopSpan: 6 },
          {
            id: "cpf",
            type: "document",
            label: "CPF",
            placeholder: "000.000.000-00",
            required: true,
            desktopSpan: 6,
            showIf: { field: "account_kind", equals: "pf" },
            help: "Máscara automática de CPF/CNPJ.",
          },
          {
            id: "company",
            type: "text",
            label: "Razão social",
            placeholder: "Ex.: Acme LTDA",
            required: true,
            desktopSpan: 6,
            showIf: { field: "account_kind", equals: "pj" },
          },
          {
            id: "cnpj",
            type: "text",
            label: "CNPJ",
            placeholder: "00.000.000/0001-00",
            desktopSpan: 6,
            showIf: { field: "account_kind", equals: "pj" },
          },
        ],
      },
      {
        id: "profile",
        title: "Perfil",
        description: "Conte um pouco sobre você.",
        desktopColumns: 2,
        fields: [
          {
            id: "goal",
            type: "buttons",
            label: "Qual seu principal objetivo?",
            required: true,
            desktopSpan: 12,
            options: [
              { value: "aprender", label: "Aprender algo novo" },
              { value: "networking", label: "Fazer networking" },
              { value: "negocios", label: "Gerar negócios" },
            ],
          },
          { id: "birth", type: "date", label: "Data de nascimento", desktopSpan: 6 },
          {
            id: "role",
            type: "select",
            label: "Seu papel",
            required: true,
            desktopSpan: 6,
            options: [
              { value: "dev", label: "Dev" },
              { value: "design", label: "Design" },
              { value: "pm", label: "Produto" },
              { value: "outro", label: "Outro" },
            ],
          },
          { id: "bio", type: "textarea", label: "Bio curta", placeholder: "O que você faz, em 1–2 frases…", desktopSpan: 12 },
        ],
      },
      {
        id: "address",
        title: "Endereço",
        description: "Usamos o CEP para preencher a cidade/UF (mock).",
        desktopColumns: 3,
        fields: [
          { id: "cep", type: "text", label: "CEP", placeholder: "01310-100", required: true, desktopSpan: 4 },
          { id: "city", type: "text", label: "Cidade", placeholder: "São Paulo", desktopSpan: 4 },
          { id: "uf", type: "select", label: "UF", desktopSpan: 4, options: ["SP", "RJ", "MG", "RS", "PR", "BA"].map((v) => ({ value: v, label: v })) },
          { id: "street", type: "text", label: "Rua / Avenida", placeholder: "Av. Paulista", desktopSpan: 8 },
          { id: "number", type: "number", label: "Número", placeholder: "1000", desktopSpan: 4 },
        ],
      },
      {
        id: "prefs",
        title: "Preferências",
        description: "Personalize sua experiência.",
        desktopColumns: 1,
        skippable: true,
        fields: [
          {
            id: "interests",
            type: "chips",
            label: "Temas de interesse",
            desktopSpan: 12,
            options: [
              { value: "ia", label: "IA" },
              { value: "mobile", label: "Mobile" },
              { value: "ux", label: "UX" },
              { value: "dados", label: "Dados" },
              { value: "cloud", label: "Cloud" },
            ],
          },
          { id: "newsletter", type: "switch", label: "Receber novidades por e-mail", defaultValue: true, desktopSpan: 12 },
          {
            id: "frequency",
            type: "radio",
            label: "Frequência",
            desktopSpan: 12,
            options: [
              { value: "daily", label: "Diária" },
              { value: "weekly", label: "Semanal" },
              { value: "monthly", label: "Mensal" },
            ],
          },
        ],
      },
      {
        id: "plan",
        title: "Plano",
        description: "Escolha como começar.",
        desktopColumns: 1,
        fields: [
          {
            id: "plan_kind",
            type: "radio",
            label: "Plano",
            required: true,
            desktopSpan: 12,
            options: [
              { value: "free", label: "Free — para testar" },
              { value: "pro", label: "Pro — R$ 49/mês" },
              { value: "enterprise", label: "Enterprise — fale com a gente" },
            ],
          },
          {
            id: "seats",
            type: "integer",
            label: "Nº de assentos",
            placeholder: "10",
            desktopSpan: 6,
            showIf: { field: "plan_kind", equals: "enterprise" },
          },
          {
            id: "expected_revenue",
            type: "currency",
            label: "Faturamento mensal (R$)",
            placeholder: "0,00",
            desktopSpan: 6,
            showIf: { field: "plan_kind", equals: "enterprise" },
          },
          {
            id: "discount_goal",
            type: "percent",
            label: "Desconto desejado (%)",
            placeholder: "0",
            desktopSpan: 6,
            showIf: { field: "plan_kind", equals: "enterprise" },
          },
          {
            id: "lgpd",
            type: "checkbox",
            label: "Li e aceito a Política de Privacidade para criar minha conta",
            required: true,
            desktopSpan: 12,
          },
        ],
      },
    ],
  };
}

export async function listOnboardings(): Promise<OnboardingConfig[]> {
  await wait();
  return readCollection();
}

export async function createOnboarding(title: string): Promise<OnboardingConfig> {
  const validatedTitle = titleSchema.parse(title);
  await wait();
  const configs = readCollection();
  const config: OnboardingConfig = {
    id: uid("onboarding"),
    version: 1,
    title: validatedTitle,
    steps: [newStep()],
  };
  while (configs.some((cfg) => cfg.id === config.id)) config.id = uid("onboarding");
  writeCollection([...configs, config]);
  return config;
}

export async function deleteOnboarding(id: string): Promise<void> {
  await wait();
  const configs = readCollection();
  requireConfig(configs, id);
  writeCollection(configs.filter((cfg) => cfg.id !== id));
  localStorage.removeItem(draftKey(id));
}

export async function fetchOnboardingConfig(id = LEGACY_ID): Promise<OnboardingConfig> {
  await wait();
  return requireConfig(readCollection(), id);
}

export async function saveOnboardingConfig(cfg: OnboardingConfig): Promise<void> {
  await wait();
  const configs = readCollection();
  requireConfig(configs, cfg.id);
  const validated = configSchema.parse(cfg);
  writeCollection(configs.map((config) => config.id === cfg.id ? validated : config));
}

export async function resetOnboardingConfig(id = LEGACY_ID): Promise<OnboardingConfig> {
  await wait();
  const configs = readCollection();
  const current = requireConfig(configs, id);
  const config = { ...defaultConfig(), id: current.id, title: current.title };
  writeCollection(configs.map((cfg) => cfg.id === id ? config : cfg));
  return config;
}

export async function submitOnboarding(values: Values, id = LEGACY_ID): Promise<{ ok: boolean; protocol: string }> {
  await wait();
  requireConfig(readCollection(), id);
  valuesSchema.parse(values);
  if (String(values.email ?? "").includes("erro")) {
    throw new Error("E-mail inválido segundo o servidor (simulação). Tente outro e-mail.");
  }
  localStorage.removeItem(draftKey(id));
  return { ok: true, protocol: `POC-${Math.floor(100000 + Math.random() * 900000)}` };
}

/** Simula GET /api/cep/:cep */
export async function lookupCep(cep: string): Promise<{ city: string; uf: string; street: string } | null> {
  await wait(500);
  const digits = cep.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return { city: "São Paulo", uf: "SP", street: "Av. Paulista" };
}

/** Simula GET /api/check-email */
export async function checkEmailAvailable(email: string): Promise<boolean> {
  await wait(400);
  return !email.includes("usado");
}

export function loadDraft(id = LEGACY_ID): Values {
  try {
    requireConfig(readCollection(), id);
    return valuesSchema.parse(JSON.parse(localStorage.getItem(draftKey(id)) ?? "{}"));
  } catch {
    return {};
  }
}

export function persistDraft(values: Values, id = LEGACY_ID): void {
  try {
    requireConfig(readCollection(), id);
    const raw = localStorage.getItem(draftKey(id));
    if (raw !== null) valuesSchema.parse(JSON.parse(raw));
    localStorage.setItem(draftKey(id), JSON.stringify(valuesSchema.parse(values)));
  } catch {
    return;
  }
}

export function newStep(): OnboardingConfig["steps"][number] {
  return {
    id: `step_${uid()}`,
    title: "Nova etapa",
    description: "Descreva o objetivo desta etapa.",
    desktopColumns: 2,
    fields: [],
  };
}

export function newField(type: string): OnboardingConfig["steps"][number]["fields"][number] {
  const id = `${type}_${uid()}`;
  const base = { id, label: `Campo ${type}`, desktopSpan: 6 as const };
  if (type === "select" || type === "radio" || type === "chips" || type === "buttons" || type === "multiselect") {
    return {
      ...base,
      type: type as never,
      desktopSpan: type === "buttons" || type === "multiselect" ? (12 as const) : (6 as const),
      options: [{ value: "op1", label: "Opção 1" }, { value: "op2", label: "Opção 2" }],
    };
  }
  if (type === "heading") return { ...base, type: "heading", label: "Título da seção", content: "Subtítulo ou texto de apoio.", headingLevel: "title" as const, desktopSpan: 12 as const };
  if (type === "divider") return { ...base, type: "divider", label: "", desktopSpan: 12 as const };
  if (type === "info") return { ...base, type: "info", label: "Bloco informativo", content: "Texto de ajuda ou contexto.", desktopSpan: 12 as const };
  if (type === "currency") return { ...base, type: "currency", label: "Valor (R$)", placeholder: "0,00", desktopSpan: 6 as const };
  if (type === "percent") return { ...base, type: "percent", label: "Percentual (%)", placeholder: "0", desktopSpan: 6 as const };
  if (type === "integer") return { ...base, type: "integer", label: "Quantidade", placeholder: "0", desktopSpan: 6 as const };
  if (type === "document") return { ...base, type: "document", label: "CPF ou CNPJ", desktopSpan: 6 as const };
  return { ...base, type: type as never };
}
