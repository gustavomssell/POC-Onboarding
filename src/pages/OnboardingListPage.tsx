import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Alert, Button, Input, Label } from "@/components/ui/primitives";
import { createOnboarding, deleteOnboarding, listOnboardings } from "@/mocks/backend";
import type { OnboardingConfig } from "@/onboarding/types";

const createSchema = z.object({
  title: z.string().trim().min(1, "Informe um nome para o onboarding.").max(120, "Use no máximo 120 caracteres."),
});

type CreateValues = z.infer<typeof createSchema>;

const actionClassName = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4";

export default function OnboardingListPage() {
  const navigate = useNavigate();
  const [onboardings, setOnboardings] = useState<OnboardingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OnboardingConfig | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const mounted = useRef(false);
  const creatingRef = useRef(false);
  const deletingRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const createTriggerRef = useRef<HTMLButtonElement | null>(null);
  const primaryCreateRef = useRef<HTMLButtonElement>(null);
  const { register, handleSubmit, reset, setFocus, formState: { errors, isSubmitting } } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: "" },
  });

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listOnboardings().then(
      (items) => {
        if (!cancelled) {
          setOnboardings(items);
          setLoading(false);
        }
      },
      () => {
        if (!cancelled) {
          setLoadError("Não foi possível carregar os onboardings. Tente novamente.");
          setLoading(false);
        }
      }
    );
    return () => { cancelled = true; };
  }, [reloadKey]);

  useEffect(() => {
    if (selected && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [selected]);

  const openCreate = (trigger: HTMLButtonElement) => {
    createTriggerRef.current = trigger;
    reset({ title: "" });
    setCreateError(null);
    createDialogRef.current?.showModal();
    setFocus("title");
  };

  const closeCreate = () => {
    if (!creatingRef.current) createDialogRef.current?.close();
  };

  const handleCreate = async ({ title }: CreateValues) => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreateError(null);
    try {
      const created = await createOnboarding(title);
      if (mounted.current) void navigate(`/onboardings/${encodeURIComponent(created.id)}/campos`);
    } catch {
      if (mounted.current) setCreateError("Não foi possível criar o onboarding. O nome foi mantido; tente novamente.");
    } finally {
      creatingRef.current = false;
    }
  };

  const closeDialog = () => {
    if (!deletingRef.current) dialogRef.current?.close();
  };

  const handleDelete = async () => {
    if (deletingRef.current || !selected) return;
    if (!onboardings.some((item) => item.id === selected.id)) {
      setDeleteError("Este onboarding não está mais na lista. Cancele para voltar.");
      return;
    }
    deletingRef.current = true;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteOnboarding(selected.id);
      if (!mounted.current) return;
      setOnboardings((items) => items.filter((item) => item.id !== selected.id));
      setNotice(`Onboarding “${selected.title}” excluído.`);
      triggerRef.current = null;
      dialogRef.current?.close();
    } catch {
      if (mounted.current) setDeleteError("Não foi possível excluir o onboarding. Tente novamente ou cancele para voltar à lista.");
    } finally {
      deletingRef.current = false;
      if (mounted.current) setDeleting(false);
    }
  };

  return (
    <section data-testid="list-page" aria-labelledby="onboardings-title" className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 id="onboardings-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">Onboardings</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Crie jornadas, organize etapas e teste a experiência de quem vai preencher.</p>
        </div>
        <Button ref={primaryCreateRef} type="button" data-testid="open-create-onboarding" aria-haspopup="dialog" className="min-h-11 shrink-0" onClick={(event) => openCreate(event.currentTarget)}><Plus aria-hidden /> Criar onboarding</Button>
      </div>

      <dialog onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled), [tabindex="0"]'));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }} ref={createDialogRef} aria-labelledby="create-dialog-title" aria-describedby="create-dialog-description" data-testid="create-onboarding-dialog" className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto overscroll-contain rounded-xl border border-border bg-background p-6 text-foreground backdrop:bg-foreground/40" onCancel={(event) => { event.preventDefault(); closeCreate(); }} onClose={() => { createTriggerRef.current?.focus(); }}>
        <h2 id="create-dialog-title" className="text-lg font-semibold">Criar onboarding</h2>
        <p id="create-dialog-description" className="mt-2 text-sm text-muted-foreground">Escolha um nome. Na próxima tela, você poderá adicionar etapas e campos.</p>
      <form onSubmit={(event) => void handleSubmit(handleCreate)(event)} noValidate aria-busy={isSubmitting} className="mt-6 flex flex-col gap-3">
        <Label htmlFor="create-onboarding-title">Nome do onboarding</Label>
        <div className="flex flex-col gap-3">
          <div className="w-full min-w-0 sm:max-w-lg">
            <Input
              {...register("title")}
              id="create-onboarding-title"
              data-testid="create-onboarding-title"
              placeholder="Ex.: Cadastro de clientes"
              maxLength={120}
              required
              readOnly={isSubmitting}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "create-title-hint create-title-error" : "create-title-hint"}
              className="h-11"
            />
            <p id="create-title-hint" className="mt-2 text-xs text-muted-foreground">Até 120 caracteres. Você pode alterar o nome depois.</p>
            {errors.title && <p id="create-title-error" role="alert" className="mt-2 text-sm text-destructive">{errors.title.message}</p>}
          </div>
          {createError && <Alert tone="error">{createError}</Alert>}
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={isSubmitting} data-testid="cancel-create-onboarding" className="min-h-11" onClick={closeCreate}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting} data-testid="create-onboarding-submit" className="min-h-11">
            {isSubmitting ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <Plus aria-hidden />}
            {isSubmitting ? "Criando…" : "Criar onboarding"}
          </Button>
          </div>
        </div>
        <span role="status" className="sr-only">{isSubmitting ? "Criando onboarding…" : ""}</span>
      </form>
      </dialog>

      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Seus onboardings</h2>
          {!loading && !loadError && <span className="text-sm text-muted-foreground tabular-nums">{onboardings.length} {onboardings.length === 1 ? "onboarding" : "onboardings"}</span>}
        </div>
        <p role="status" className={notice ? "text-sm text-muted-foreground" : "sr-only"}>{notice}</p>
        {loading && (
          <div role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" /> Carregando onboardings…
          </div>
        )}
        {!loading && loadError && (
          <Alert className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{loadError}</p>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => {
              setLoading(true);
              setLoadError(null);
              setReloadKey((key) => key + 1);
            }}>
              <RefreshCw aria-hidden /> Tentar novamente
            </Button>
          </Alert>
        )}
        {!loading && !loadError && onboardings.length === 0 && (
          <div className="space-y-2 rounded-lg bg-muted/50 px-5 py-10 sm:px-8">
            <h3 className="text-lg font-medium">Seu primeiro onboarding começa aqui</h3>
            <p className="max-w-lg text-sm text-muted-foreground">Crie um onboarding para começar a organizar as etapas e os campos da sua jornada.</p>
            <Button type="button" variant="outline" className="mt-3 min-h-11" aria-haspopup="dialog" onClick={(event) => openCreate(event.currentTarget)}>Criar primeiro onboarding</Button>
          </div>
        )}
        {!loading && !loadError && onboardings.length > 0 && (
          <ul aria-label="Onboardings" className="divide-y divide-border border-y border-border">
            {onboardings.map((item) => {
              const fieldCount = item.steps.reduce((total, step) => total + step.fields.length, 0);
              const basePath = `/onboardings/${encodeURIComponent(item.id)}`;
              return (
                <li key={item.id} data-testid={`onboarding-row-${item.id}`} className="flex min-w-0 flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <div className="min-w-0 space-y-1">
                    <h3 className="font-medium wrap-anywhere">{item.title}</h3>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {item.steps.length} {item.steps.length === 1 ? "etapa" : "etapas"} · {fieldCount} {fieldCount === 1 ? "campo" : "campos"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <Link to={`${basePath}/campos`} aria-label={`Editar ${item.title}`} className={actionClassName}><Pencil aria-hidden /> Editar</Link>
                    <Link to={`${basePath}/testar`} aria-label={`Testar ${item.title}`} className={actionClassName}><Play aria-hidden /> Testar</Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Excluir onboarding ${item.title}`}
                      title={`Excluir ${item.title}`}
                      data-testid={`delete-onboarding-${item.id}`}
                      disabled={isSubmitting || deleting}
                      onClick={(event) => {
                        triggerRef.current = event.currentTarget;
                        setDeleteError(null);
                        setSelected(item);
                      }}
                    ><Trash2 aria-hidden /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        aria-busy={deleting}
        className="fixed inset-0 m-auto max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-border bg-background p-6 text-foreground backdrop:bg-foreground/40"
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
        onClose={() => {
          setSelected(null);
          setDeleteError(null);
          if (triggerRef.current?.isConnected) triggerRef.current.focus();
          else primaryCreateRef.current?.focus();
          triggerRef.current = null;
        }}
      >
        <h2 id="delete-dialog-title" className="text-lg font-semibold">Excluir onboarding?</h2>
        <p id="delete-dialog-description" className="mt-3 text-sm leading-relaxed text-muted-foreground wrap-anywhere">
          O onboarding <strong className="font-medium text-foreground">“{selected?.title ?? "selecionado"}”</strong>, suas etapas, campos e o rascunho de respostas salvo neste navegador serão excluídos. Esta ação é irreversível.
        </p>
        {deleteError && <Alert className="mt-4">{deleteError}</Alert>}
        {deleting && <p role="status" className="mt-4 text-sm text-muted-foreground">Excluindo onboarding…</p>}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" autoFocus disabled={deleting} data-testid="cancel-delete" className="min-h-11" onClick={closeDialog}>Cancelar</Button>
          <Button type="button" variant="destructive" disabled={deleting || !selected} data-testid="confirm-delete" className="min-h-11" onClick={() => void handleDelete()}>
            {deleting ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <Trash2 aria-hidden />}
            {deleting ? "Excluindo…" : "Excluir onboarding"}
          </Button>
        </div>
      </dialog>
    </section>
  );
}
