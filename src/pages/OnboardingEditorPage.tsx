import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, NavLink, useBlocker, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Hammer, Monitor, Play, Save, Smartphone, Workflow } from "lucide-react";
import { Alert, Button, Input, Label, Skeleton } from "@/components/ui/primitives";
import { fetchOnboardingConfig, resetOnboardingConfig, saveOnboardingConfig } from "@/mocks/backend";
import type { OnboardingConfig } from "@/onboarding/types";
import { OnboardingProvider } from "@/onboarding/engine";
import { Runtime } from "@/onboarding/Runtime";
import { cn } from "@/lib/utils";

const Builder = lazy(() => import("@/builder/Builder").then((m) => ({ default: m.Builder })));
const FlowBuilder = lazy(() => import("@/flow/FlowBuilder").then((m) => ({ default: m.FlowBuilder })));
const modes = [
  { path: "testar", label: "Testar", testId: "runtime", icon: Play },
  { path: "campos", label: "Campos", testId: "builder", icon: Hammer },
  { path: "fluxo", label: "Fluxo", testId: "flow", icon: Workflow },
];

export default function OnboardingEditorPage() {
  const { id = "", mode = "campos" } = useParams();
  if (!modes.some((item) => item.path === mode)) {
    return <section className="flex flex-col gap-4"><h1 className="text-xl font-semibold">Página não encontrada</h1><Link to="/onboardings" className="underline">Voltar aos onboardings</Link></section>;
  }
  return <Editor key={id} id={id} mode={mode} />;
}

function Editor({ id, mode }: { id: string; mode: string }) {
  const navigate = useNavigate();
  const [config, setConfig] = useState<OnboardingConfig | null>(null);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [runtimeKey, setRuntimeKey] = useState(0);
  const [device, setDevice] = useState<"mobile" | "desktop">("desktop");
  const busy = useRef(false);
  const dirty = config !== null && JSON.stringify(config) !== saved;
  const base = `/onboardings/${encodeURIComponent(id)}`;
  const blocker = useBlocker(({ nextLocation }) => dirty && !modes.some((item) => nextLocation.pathname === `${base}/${item.path}`));
  const leaveDialog = useRef<HTMLDialogElement>(null);
  const resetDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchOnboardingConfig(id).then((result) => {
      if (cancelled) return;
      setConfig(result);
      setSaved(JSON.stringify(result));
      setLoading(false);
    }, (reason: unknown) => {
      if (cancelled) return;
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar este onboarding.");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, retry]);

  useEffect(() => {
    if (blocker.state === "blocked") leaveDialog.current?.showModal();
    else leaveDialog.current?.close();
  }, [blocker.state]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async () => {
    if (!config || busy.current) return false;
    if (!config.title.trim() || config.title.trim().length > 120) {
      setError("Informe um nome entre 1 e 120 caracteres.");
      return false;
    }
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const next = { ...config, title: config.title.trim(), version: config.version + 1 };
      await saveOnboardingConfig(next);
      setConfig(next);
      setSaved(JSON.stringify(next));
      setNotice("Alterações salvas.");
      setRuntimeKey((key) => key + 1);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar. Tente novamente.");
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const reset = async () => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const next = await resetOnboardingConfig(id);
      setConfig(next);
      setSaved(JSON.stringify(next));
      setNotice("Modelo padrão restaurado neste onboarding.");
      setRuntimeKey((key) => key + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível restaurar o modelo.");
    } finally {
      busy.current = false;
      setSaving(false);
      resetDialog.current?.close();
    }
  };

  if (loading) return <div aria-busy="true" aria-label="Carregando onboarding"><Skeleton className="h-64 w-full" /></div>;
  if (!config) return (
    <section className="flex flex-col items-start gap-4">
      <h1 className="text-xl font-semibold">Onboarding indisponível</h1>
      <Alert tone="error">{error}</Alert>
      <Button variant="outline" onClick={() => { setLoading(true); setError(null); setRetry((n) => n + 1); }}>Tentar novamente</Button>
      <Link to="/onboardings" className="underline">Voltar aos onboardings</Link>
    </section>
  );

  return (
    <>
      <Link to="/onboardings" className="inline-flex w-fit items-center gap-2 rounded text-sm text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" /> Todos os onboardings</Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="text-xl font-semibold wrap-anywhere">{config.title || "Sem nome"}</h1>
          {mode !== "testar" && <><Label htmlFor="onboarding-title">Nome do onboarding</Label><Input id="onboarding-title" data-testid="onboarding-title" maxLength={120} value={config.title} disabled={saving} onChange={(e) => { setConfig({ ...config, title: e.target.value }); setNotice(""); }} className="max-w-lg" /></>}
          <p role="status" className="text-xs text-muted-foreground">{dirty ? "Alterações não salvas" : notice || `${config.steps.length} etapas · Versão ${config.version}`}</p>
        </div>
        <Button onClick={() => void save()} disabled={saving || !dirty} data-testid="editor-save"><Save /> {saving ? "Salvando…" : "Salvar alterações"}</Button>
      </div>
      <nav aria-label="Editar onboarding" className="flex flex-wrap gap-1 border-b pb-3">
        {modes.map(({ path, label, testId, icon: Icon }) => <NavLink key={path} to={`${base}/${path}`} data-testid={`tab-${testId}`} className={({ isActive }) => cn("inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm focus-visible:ring-2 focus-visible:ring-ring", isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted")}><Icon className="size-4" />{label}</NavLink>)}
      </nav>
      {error && <Alert tone="error">{error}</Alert>}
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        {mode === "testar" && (
          <>
            <div className="flex items-center justify-end">
              <span className="flex overflow-hidden rounded-lg border" role="group" aria-label="Preview do dispositivo">
                <button type="button" onClick={() => setDevice("mobile")} aria-pressed={device === "mobile"} data-testid="runtime-preview-mobile" className={cn("flex items-center gap-1 px-3 py-1.5 text-sm", device === "mobile" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}><Smartphone className="size-4" /> Mobile</button>
                <button type="button" onClick={() => setDevice("desktop")} aria-pressed={device === "desktop"} data-testid="runtime-preview-desktop" className={cn("flex items-center gap-1 px-3 py-1.5 text-sm", device === "desktop" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}><Monitor className="size-4" /> Desktop</button>
              </span>
            </div>
            <OnboardingProvider key={`${id}-${runtimeKey}`} config={config}>
              {device === "mobile" ? (
                <div className="mx-auto w-fit rounded-[2.5rem] border-[6px] border-foreground/80 bg-background p-2 shadow-xl" style={{ height: 780 }}>
                  <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-muted-foreground/40" aria-hidden />
                  <div className="h-full overflow-y-auto overflow-x-hidden rounded-[1.8rem] px-3 pb-5 pt-2" style={{ width: 390 }}>
                    <Runtime device="mobile" />
                  </div>
                </div>
              ) : (
                <Runtime device="desktop" />
              )}
            </OnboardingProvider>
          </>
        )}
        {mode !== "testar" && <fieldset disabled={saving} className="min-w-0 border-0 p-0">
          {mode === "campos" && <Builder config={config} onChange={setConfig} onSave={() => void save()} onReset={() => resetDialog.current?.showModal()} saving={saving} />}
          {mode === "fluxo" && <div className="flex flex-col gap-4"><div className="flex flex-wrap gap-2"><Button data-testid="flow-save" disabled={saving} onClick={() => void save()}>Salvar fluxo</Button><Button data-testid="flow-save-test" variant="secondary" disabled={saving} onClick={() => { void save().then((ok) => { if (ok) void navigate(`${base}/testar`); }); }}><Play /> Salvar e testar</Button></div><FlowBuilder config={config} onChange={setConfig} /></div>}
        </fieldset>}
      </Suspense>
      <dialog ref={leaveDialog} aria-labelledby="leave-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-background p-6 text-foreground backdrop:bg-foreground/40" onCancel={(event) => { event.preventDefault(); if (blocker.state === "blocked") blocker.reset(); }}>
        <h2 id="leave-title" className="text-lg font-semibold">Descartar alterações?</h2>
        <p className="mt-3 text-sm text-muted-foreground">As alterações não salvas neste onboarding serão perdidas.</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2"><Button autoFocus variant="outline" onClick={() => { if (blocker.state === "blocked") blocker.reset(); }}>Continuar editando</Button><Button variant="destructive" onClick={() => { if (blocker.state === "blocked") blocker.proceed(); }}>Descartar e sair</Button></div>
      </dialog>
      <dialog ref={resetDialog} aria-labelledby="reset-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-background p-6 text-foreground backdrop:bg-foreground/40" onCancel={(event) => { if (saving) event.preventDefault(); }}>
        <h2 id="reset-title" className="text-lg font-semibold">Restaurar modelo padrão?</h2>
        <p className="mt-3 text-sm text-muted-foreground">Todas as etapas e campos deste onboarding serão substituídos. Os outros onboardings não serão alterados.</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2"><Button autoFocus variant="outline" disabled={saving} onClick={() => resetDialog.current?.close()}>Cancelar</Button><Button variant="destructive" disabled={saving} onClick={() => void reset()}>Restaurar modelo</Button></div>
      </dialog>
    </>
  );
}
