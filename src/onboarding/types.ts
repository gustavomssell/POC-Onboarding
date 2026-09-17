export type FieldType =
  | "text"
  | "email"
  | "password"
  | "tel"
  | "number"
  | "integer"
  | "currency"
  | "percent"
  | "document"
  | "date"
  | "textarea"
  | "select"
  | "radio"
  | "buttons"
  | "checkbox"
  | "multiselect"
  | "switch"
  | "chips"
  | "heading"
  | "divider"
  | "info";

export interface FieldOption {
  value: string;
  label: string;
}

export interface ShowIf {
  /** id do campo de origem */
  field: string;
  /** valor(es) que tornam este campo visível */
  equals: string | string[];
}

export interface FieldConfig {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  help?: string;
  required?: boolean;
  options?: FieldOption[];
  defaultValue?: string | boolean | string[];
  /** sempre 12 no mobile (1 coluna). | desktop: fração do grid de 12 cols */
  desktopSpan?: 4 | 6 | 8 | 12;
  showIf?: ShowIf;
  minLength?: number;
  content?: string; // p/ type=info | heading (subtítulo)
  /** p/ type=heading: estilo do bloco */
  headingLevel?: "title" | "subtitle";
}

export interface StepConfig {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  /** nº de colunas do grid no desktop (mobile sempre 1) */
  desktopColumns?: 1 | 2 | 3;
  skippable?: boolean;
  fields: FieldConfig[];
}

/**
 * Ligação do grafo de fluxo (aba "Fluxo", React Flow).
 * - `when` ausente = transição padrão ("sempre").
 * - Com `when`, a aresta só é seguida se a resposta bater; condicionais têm
 *   prioridade sobre a padrão (avaliadas primeiro, na ordem do array).
 * - Etapa sem aresta de saída → cai no próximo passo linear.
 * - `edges` vazio/ausente = fluxo 100% linear (comportamento original).
 */
export interface StepEdge {
  id: string;
  from: string;
  to: string;
  when?: ShowIf;
}

export interface OnboardingConfig {
  id: string;
  version: number;
  title: string;
  steps: StepConfig[];
  edges?: StepEdge[];
  /** posições dos nós no canvas do Fluxo (persistidas ao arrastar) */
  positions?: Record<string, { x: number; y: number }>;
}

export type Values = Record<string, string | boolean | string[] | undefined>;
export type Errors = Record<string, string>;
