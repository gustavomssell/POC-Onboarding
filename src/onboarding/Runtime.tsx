import { useEffect, useMemo, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { isInputField } from "./schema";
import { AnimatePresence, motion } from "framer-motion";
import type { Control } from "react-hook-form";
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, RotateCcw, Send, SkipForward, Split } from "lucide-react";
import { useOnboarding } from "./engine";
import { isFieldVisible } from "./engine";
import { DynamicField } from "./fields";
import type { FieldConfig, Values } from "./types";
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress, Separator } from "@/components/ui/primitives";
import { cn, SHOW_DEBUG } from "@/lib/utils";

function FieldControl({
  f,
  fi,
  control,
  clearErrors,
  ob,
}: {
  f: FieldConfig;
  fi: number;
  control: Control<Values>;
  clearErrors: (id: string) => void;
  ob: ReturnType<typeof useOnboarding>;
}) {
  if (!isInputField(f)) {
    return (
      <DynamicField
        field={f}
        value={ob.values[f.id]}
        allValues={ob.values}
        onChange={() => {}}
        autoFocus={false}
      />
    );
  }
  return (
    <Controller
      control={control}
      name={f.id}
      render={({ field: { value, onChange }, fieldState }) => (
        <DynamicField
          field={f}
          value={value}
          error={ob.errors[f.id] ?? fieldState.error?.message}
          allValues={ob.values}
          onChange={(v) => {
            onChange(v);
            clearErrors(f.id);
          }}
          autoFocus={fi === 0}
        />
      )}
    />
  );
}

export function Runtime({ device = "auto" }: { device?: "auto" | "mobile" | "desktop" }) {
  const ob = useOnboarding();
  const { control, clearErrors } = useFormContext<Values>();
  const { visibleSteps, currentId } = ob;
  const step = visibleSteps.find((s) => s.id === currentId) ?? visibleSteps[0];
  const hasGraph = (ob.config.edges?.length ?? 0) > 0;

  // CEP mock → autofill (deps estáveis: setValue é memoizado na engine)
  const setValue = ob.setValue;
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as { city: string; uf: string; street: string };
      setValue("city", d.city);
      setValue("uf", d.uf);
      setValue("street", d.street);
    };
    window.addEventListener("poc:cep", h);
    return () => window.removeEventListener("poc:cep", h);
  }, [setValue]);

  // foco vai para o primeiro campo via autoFocus nativo (sem roubo temporizado)

  const summary = useMemo(
    () =>
      visibleSteps.flatMap((s) =>
        s.fields
          .filter((f) => f.type !== "info" && f.type !== "password" && isFieldVisible(f, ob.values))
          .map((f) => ({ step: s.title, field: f, value: ob.values[f.id] }))
      ),
    [visibleSteps, ob.values]
  );

  const pathTitles = useMemo(
    () =>
      ob.path
        .map((id) => visibleSteps.find((s) => s.id === id)?.title ?? id)
        .filter(Boolean),
    [ob.path, visibleSteps]
  );
  const [copied, setCopied] = useState(false);

  if (!step) return <Alert tone="error">Configuração sem etapas.</Alert>;

  if (ob.submitted) {
    return (
      <Card data-testid="success-screen" className="mx-auto w-full max-w-2xl p-2">
        <CardHeader className="items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-green-600/15">
            <Check className="size-6 text-green-600" />
          </span>
          <CardTitle>Onboarding concluído!</CardTitle>
          <CardDescription className="flex flex-wrap items-center justify-center gap-2">
            Protocolo
            <Badge data-testid="protocol">{ob.protocol}</Badge>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(ob.protocol ?? "").then(() => setCopied(true));
              }}
              aria-label="Copiar protocolo"
              title="Copiar protocolo"
              className="inline-flex size-7 items-center justify-center rounded-lg border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copied ? <Check className="size-3.5 text-green-600" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
            </button>
            {copied && <span aria-live="polite" className="text-xs">Copiado!</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="rounded-lg border">
            {summary.filter((s) => s.value !== undefined && s.value !== "").map((s) => (
              <div key={s.field.id} className="flex items-start justify-between gap-3 border-b px-3 py-2 text-sm last:border-0">
                <span className="min-w-0 break-words text-muted-foreground">
                  {s.step} · {s.field.label}
                </span>
                <span className="min-w-0 text-right font-medium break-words">{Array.isArray(s.value) ? s.value.join(", ") : String(s.value)}</span>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={ob.reset} data-testid="restart">
            <RotateCcw /> Recomeçar (limpa rascunho)
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isLast = ob.nextId === null;
  const mobilePreview = device === "mobile";

  return (
    <div
      className={cn(
        "@container mx-auto flex w-full flex-col gap-4",
        mobilePreview ? "h-full max-w-[400px]" : "max-w-3xl"
      )}
    >
      {/* stepper acessível — no modo grafo, só passos visitados são clicáveis */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium" aria-live="polite" data-testid="step-counter">
            Etapa {ob.index + 1} de {visibleSteps.length} — {step.title}
          </span>
          <span className="text-muted-foreground">{Math.round(ob.progress * 100)}%</span>
        </div>
        <Progress value={ob.progress} />
        <ol className={cn("mt-1 hidden flex-wrap gap-1.5", mobilePreview ? "" : "sm:flex")} aria-label="Etapas do onboarding">
          {visibleSteps.map((s, i) => {
            const isCurrent = s.id === currentId;
            const wasVisited = ob.visited.has(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => ob.goTo(i)}
                  disabled={!wasVisited}
                  aria-current={isCurrent ? "step" : undefined}
                  data-testid={`goto-step-${i}`}
                  title={wasVisited ? s.title : `${s.title} (ainda não visitada)`}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all disabled:opacity-45",
                    isCurrent
                      ? "border-primary bg-primary text-primary-foreground"
                      : wasVisited
                        ? "border-primary/40 bg-primary/10"
                        : "hover:bg-muted"
                  )}
                >
                  {wasVisited && !isCurrent ? <Check className="size-3" /> : <span>{i + 1}</span>}
                  <span className="hidden sm:inline">{s.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {SHOW_DEBUG && hasGraph && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="graph-path" aria-live="polite">
            <Split className="size-3.5" aria-hidden />
            Fluxo por respostas — caminho até aqui: {pathTitles.join(" → ")}
          </p>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id + currentId}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.22 }}
          className={cn(mobilePreview && "flex min-h-0 flex-1 flex-col")}
        >
          <Card className={cn(mobilePreview && "flex min-h-0 w-full flex-1 flex-col overflow-hidden")}>
            <CardHeader className={cn(mobilePreview && "shrink-0")}>
              <CardTitle className="text-xl">{step.title}</CardTitle>
              {step.description && <CardDescription className="text-[15px]">{step.description}</CardDescription>}
            </CardHeader>
            <CardContent className={cn(mobilePreview && "flex min-h-0 flex-1 flex-col")}>
              <form
                data-step={ob.index}
                data-testid={`step-form-${step.id}`}
                className={cn(mobilePreview ? "flex h-full min-h-0 flex-1 flex-col gap-4" : "grid grid-cols-1 gap-4 @md:grid-cols-12")}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (isLast) void ob.submit();
                  else ob.next();
                }}
                noValidate
              >
                {mobilePreview ? (
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {step.fields.map((f, fi) => (
                      <FieldControl key={f.id} f={f} fi={fi} control={control} clearErrors={clearErrors} ob={ob} />
                    ))}
                    {ob.serverError && <Alert tone="error">{ob.serverError}</Alert>}
                  </div>
                ) : (
                  <>
                    {step.fields.map((f, fi) => (
                      <FieldControl key={f.id} f={f} fi={fi} control={control} clearErrors={clearErrors} ob={ob} />
                    ))}
                    {ob.serverError && <Alert tone="error">{ob.serverError}</Alert>}
                  </>
                )}

                <div className={cn("flex flex-col gap-2", mobilePreview ? "shrink-0" : "col-span-1 @md:col-span-12")}>
                  <Separator />
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                    <Button type="button" variant="outline" onClick={ob.back} disabled={ob.path.length <= 1} data-testid="btn-back">
                      <ArrowLeft /> Voltar
                    </Button>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {step.skippable && (
                        <Button type="button" variant="ghost" onClick={ob.skip} data-testid="btn-skip">
                          <SkipForward /> Pular etapa
                        </Button>
                      )}
                      {!isLast ? (
                        <Button type="submit" data-testid="btn-next">
                          Continuar <ArrowRight />
                        </Button>
                      ) : (
                        <Button type="submit" disabled={ob.status === "submitting"} data-testid="btn-submit">
                          {ob.status === "submitting" ? (
                            <>
                              <Loader2 className="animate-spin" /> Enviando…
                            </>
                          ) : (
                            <>
                              <Send /> Concluir cadastro
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-center text-xs text-muted-foreground sm:text-left">
                    Pressione Enter para avançar
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
