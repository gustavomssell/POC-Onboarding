import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Errors, OnboardingConfig, StepEdge, Values } from "./types";
import { loadDraft, persistDraft, submitOnboarding } from "../mocks/backend";
import { validateStepFields } from "./schema";
import { FormProvider, useForm, useWatch } from "react-hook-form";

export { isFieldVisible, validateWithSchema as validateField } from "./schema";

function whenMatches(when: NonNullable<StepEdge["when"]>, values: Values): boolean {
  const v = values[when.field];
  const exp = when.equals;
  if (Array.isArray(v)) return Array.isArray(exp) ? exp.some((e) => v.includes(e)) : v.includes(exp as string);
  return Array.isArray(exp) ? exp.includes(String(v ?? "")) : String(v ?? "") === exp;
}

/**
 * Resolve o próximo passo a partir do atual.
 * 1. Arestas condicionais (na ordem do array) cuja condição bate;
 * 2. Primeira aresta "sempre" (sem `when`);
 * 3. Fallback: próximo passo linear (fluxo sem grafo continua funcionando).
 * Retorna null quando o passo atual é um fim (→ tela de submit/sucesso).
 */
export function resolveNextId(
  currentId: string,
  values: Values,
  steps: OnboardingConfig["steps"],
  edges: StepEdge[] | undefined
): string | null {
  const ids = new Set(steps.map((s) => s.id));
  const out = (edges ?? []).filter((e) => e.from === currentId && ids.has(e.to) && e.to !== currentId);
  for (const e of out) {
    if (e.when && whenMatches(e.when, values)) return e.to;
  }
  const always = out.find((e) => !e.when);
  if (always) return always.to;
  const i = steps.findIndex((s) => s.id === currentId);
  const nxt = steps[i + 1];
  return nxt ? nxt.id : null;
}

/** Detecta ciclo no grafo (usado pelo builder p/ alertar). */
export function findCycle(steps: OnboardingConfig["steps"], edges: StepEdge[] | undefined): string[] | null {
  const adj = new Map<string, string[]>();
  for (const s of steps) adj.set(s.id, []);
  for (const e of edges ?? []) {
    if (adj.has(e.from) && adj.has(e.to)) adj.get(e.from)!.push(e.to);
  }
  const color = new Map<string, number>();
  const stack: string[] = [];
  const dfs = (id: string): string[] | null => {
    color.set(id, 1);
    stack.push(id);
    for (const nxt of adj.get(id) ?? []) {
      if (color.get(nxt) === 1) return [...stack.slice(stack.indexOf(nxt)), nxt];
      if (!color.get(nxt)) {
        const c = dfs(nxt);
        if (c) return c;
      }
    }
    stack.pop();
    color.set(id, 2);
    return null;
  };
  for (const s of steps) {
    if (!color.get(s.id)) {
      const c = dfs(s.id);
      if (c) return c;
    }
  }
  return null;
}

interface Engine {
  config: OnboardingConfig;
  values: Values;
  errors: Errors;
  /** caminho percorrido (ids), último = atual — suporta desvios do grafo */
  path: string[];
  currentId: string;
  /** posição linear do passo atual (p/ "Etapa X de Y") */
  index: number;
  visibleSteps: OnboardingConfig["steps"];
  visited: Set<string>;
  /** próximo id resolvido (null = fim → submit) */
  nextId: string | null;
  progress: number;
  status: "idle" | "submitting" | "success" | "error";
  serverError: string | null;
  protocol: string | null;
  submitted: boolean;
  setValue: (id: string, v: Values[string]) => void;
  validateStep: (stepId?: string) => boolean;
  next: () => boolean;
  back: () => void;
  goTo: (i: number) => void;
  skip: () => void;
  submit: () => Promise<void>;
  reset: () => void;
}

const Ctx = createContext<Engine | null>(null);

export function OnboardingProvider(props: { config: OnboardingConfig; children: React.ReactNode }) {
  return <OnboardingSession key={props.config.id} {...props} />;
}

function OnboardingSession({
  config,
  children,
}: {
  config: OnboardingConfig;
  children: React.ReactNode;
}) {
  const [seed] = useState<Values>(() => {
    const draft = loadDraft(config.id);
    const defs: Values = {};
    for (const s of config.steps) for (const f of s.fields) if (f.defaultValue !== undefined) defs[f.id] = f.defaultValue;
    return { ...defs, ...draft };
  });

  const form = useForm<Values>({ defaultValues: seed, mode: "onSubmit" });
  const { reset: resetForm, setValue: setFormValue, clearErrors, setError, formState } = form;
  const values = useWatch({ control: form.control }) as Values;
  const errors: Errors = {};
  for (const [id, error] of Object.entries(formState.errors)) {
    if (typeof error?.message === "string") errors[id] = error.message;
  }
  const setErrors = useCallback((nextErrors: Errors) => {
    clearErrors();
    for (const [id, message] of Object.entries(nextErrors)) setError(id, { type: "zod", message });
  }, [clearErrors, setError]);
  const [path, setPath] = useState<string[]>(() => [config.steps[0]?.id ?? ""]);
  const [status, setStatus] = useState<Engine["status"]>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<string | null>(null);

  const stepIds = useMemo(() => new Set(config.steps.map((s) => s.id)), [config.steps]);

  // troca de config (ex.: Builder salvou) → garante caminho válido
  const firstId = config.steps[0]?.id ?? "";
  useEffect(() => {
    setPath((p) => {
      const kept = p.filter((id) => stepIds.has(id));
      return kept.length > 0 ? kept : [firstId];
    });
  }, [stepIds, firstId]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (status === "submitting" || status === "success") return;
    timer.current = setTimeout(() => persistDraft(values, config.id), 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [values, config.id, status]);

  const visibleSteps = useMemo(() => config.steps, [config]);
  const currentId = path[path.length - 1] ?? firstId;
  const visited = useMemo(() => new Set(path), [path]);
  const nextId = useMemo(
    () => resolveNextId(currentId, values, visibleSteps, config.edges),
    [currentId, values, visibleSteps, config.edges]
  );
  const index = Math.max(
    0,
    visibleSteps.findIndex((s) => s.id === currentId)
  );

  const setValue = useCallback(
    (id: string, v: Values[string]) => {
      setFormValue(id, v, { shouldValidate: false, shouldDirty: true });
      clearErrors(id);
    },
    [setFormValue, clearErrors]
  );

  const validateStep = useCallback(
    (stepId?: string) => {
      const step = visibleSteps.find((s) => s.id === (stepId ?? currentId));
      if (!step) return true;
      const nextErr = validateStepFields(step.fields, values);
      setErrors(nextErr);
      return Object.keys(nextErr).length === 0;
    },
    [visibleSteps, currentId, values, setErrors]
  );

  const next = useCallback(() => {
    if (!validateStep()) return false;
    const nxt = resolveNextId(currentId, values, visibleSteps, config.edges);
    if (nxt) {
      setPath((p) => [...p, nxt]);
      return true;
    }
    return false;
  }, [currentId, validateStep, values, visibleSteps, config.edges]);

  const back = useCallback(() => setPath((p) => (p.length > 1 ? p.slice(0, -1) : p)), []);

  const goTo = useCallback(
    (i: number) => {
      // Navegação livre só para passos já visitados (não fura validação nem regra do grafo).
      // Voltar trunca o caminho: refazer uma resposta pode mudar o desvio seguinte.
      const target = visibleSteps[i];
      if (!target) return;
      setPath((p) => {
        const at = p.indexOf(target.id);
        if (at < 0) return p;
        return p.slice(0, at + 1);
      });
    },
    [visibleSteps]
  );

  const skip = useCallback(() => {
    // Pular segue a mesma resolução do grafo (não o linear cego):
    // nunca pousa em etapa inalcançável pelas regras atuais.
    const nxt = resolveNextId(currentId, values, visibleSteps, config.edges);
    if (nxt && nxt !== currentId) setPath((p) => [...p, nxt]);
  }, [visibleSteps, currentId, values, config.edges]);

  const submit = useCallback(async () => {
    // valida só o que foi visitado: passos desviados pelo grafo não bloqueiam
    for (const id of path) {
      const step = visibleSteps.find((s) => s.id === id);
      if (!step) continue;
      const stepErrors = validateStepFields(step.fields, values);
      if (Object.keys(stepErrors).length) {
        setPath((p) => {
          const at = p.indexOf(id);
          return at >= 0 ? p.slice(0, at + 1) : p;
        });
        setErrors(stepErrors);
        return;
      }
    }
    setStatus("submitting");
    setServerError(null);
    try {
      const res = await submitOnboarding(values, config.id);
      setProtocol(res.protocol);
      setStatus("success");
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Falha ao enviar.");
      setStatus("error");
    }
  }, [path, visibleSteps, values, setErrors, config.id]);

  const reset = useCallback(() => {
    resetForm({});
    setErrors({});
    setPath([firstId]);
    setStatus("idle");
    setProtocol(null);
    setServerError(null);
  }, [firstId, resetForm, setErrors]);

  const value: Engine = {
    config,
    values,
    errors,
    path,
    currentId,
    index,
    visibleSteps,
    visited,
    nextId,
    progress: visibleSteps.length === 0 ? 1 : visited.size / visibleSteps.length,
    status,
    serverError,
    protocol,
    submitted: status === "success",
    setValue,
    validateStep,
    next,
    back,
    goTo,
    skip,
    submit,
    reset,
  };

  return <FormProvider {...form}><Ctx.Provider value={value}>{children}</Ctx.Provider></FormProvider>;
}

export function useOnboarding(): Engine {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOnboarding fora do provider");
  return ctx;
}
