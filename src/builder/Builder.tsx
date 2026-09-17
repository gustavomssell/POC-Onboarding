import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Eye,
  GripVertical,
  Monitor,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import type { FieldConfig, FieldType, OnboardingConfig, StepConfig } from "@/onboarding/types";
import { newField, newStep } from "@/mocks/backend";
import { DynamicField } from "@/onboarding/fields";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const PALETTE: { group: string; items: { type: FieldType; label: string; hint: string }[] }[] = [
  {
    group: "Texto e números",
    items: [
      { type: "text", label: "Texto", hint: "nome, empresa…" },
      { type: "email", label: "E-mail", hint: "com validação" },
      { type: "password", label: "Senha", hint: "mín. caracteres" },
      { type: "tel", label: "Telefone", hint: "inputMode tel" },
      { type: "number", label: "Número", hint: "decimais" },
      { type: "integer", label: "Inteiro", hint: "só inteiros" },
      { type: "currency", label: "Monetário", hint: "R$ + máscara" },
      { type: "percent", label: "Porcentagem", hint: "0–100 %" },
      { type: "document", label: "CPF/CNPJ", hint: "máscara auto" },
      { type: "date", label: "Data", hint: "nascimento…" },
      { type: "textarea", label: "Texto longo", hint: "bio, obs…" },
    ],
  },
  {
    group: "Escolha",
    items: [
      { type: "buttons", label: "Botões", hint: "1 opção, grande" },
      { type: "radio", label: "Rádio / pills", hint: "1 opção" },
      { type: "select", label: "Select", hint: "dropdown" },
      { type: "multiselect", label: "Múltipla escolha", hint: "N opções, cards" },
      { type: "chips", label: "Chips multi", hint: "interesses" },
      { type: "checkbox", label: "Checkbox", hint: "LGPD, aceite" },
      { type: "switch", label: "Switch", hint: "on/off" },
    ],
  },
  {
    group: "Conteúdo",
    items: [
      { type: "heading", label: "Título", hint: "título/subtítulo" },
      { type: "divider", label: "Divisória", hint: "separador" },
      { type: "info", label: "Bloco info", hint: "texto ajuda" },
    ],
  },
];

function PaletteItem({ type, label, hint }: { type: FieldType; label: string; hint: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `new:${type}`, data: { kind: "new", fieldType: type } });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-testid={`palette-${type}`}
      title="Arraste para uma etapa ou clique em + na etapa"
      className={cn(
        "flex cursor-grab items-center gap-2 rounded-lg border bg-background p-2 text-sm active:cursor-grabbing hover:bg-muted",
        isDragging && "opacity-50"
      )}
    >
      <GripVertical className="size-4 text-muted-foreground" aria-hidden />
      <div className="leading-tight">
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function SortableFieldRow({
  field,
  stepId,
  selected,
  onSelect,
  onRemove,
}: {
  field: FieldConfig;
  stepId: string;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id, data: { kind: "field", stepId } });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid={`builder-field-${field.id}`}
      className={cn("rounded-lg border bg-background p-2", selected ? "border-primary ring-2 ring-primary/30" : "", isDragging && "opacity-60")}
    >
      <div className="mb-1 flex items-center gap-1">
        <button type="button" {...attributes} {...listeners} aria-label={`Arrastar campo ${field.label}`} className="cursor-grab rounded p-1 hover:bg-muted">
          <GripVertical className="size-4 text-muted-foreground" />
        </button>
        <Badge>{field.type}</Badge>
        <span className="truncate text-xs font-medium">{field.label}</span>
        <span className="ml-auto flex gap-1">
          <button type="button" onClick={onSelect} aria-label="Editar campo" className="rounded p-1 hover:bg-muted">
            <Pencil className="size-3.5" />
          </button>
          <button type="button" onClick={onRemove} aria-label="Remover campo" className="rounded p-1 text-destructive hover:bg-destructive/10">
            <Trash2 className="size-3.5" />
          </button>
        </span>
      </div>
      <div className="pointer-events-none opacity-90 [&_button]:pointer-events-none [&_input]:pointer-events-none [&_select]:pointer-events-none [&_textarea]:pointer-events-none">
        <div className="min-w-0">
          <DynamicField field={field} value={field.defaultValue ?? ""} allValues={{}} onChange={() => {}} disabled />
        </div>
      </div>
    </div>
  );
}

function StepDropZone({ step, children }: { step: StepConfig; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `step:${step.id}`, data: { kind: "step", stepId: step.id } });
  return (
    <div ref={setNodeRef} className={cn("flex flex-col gap-2 rounded-lg p-1 transition-colors", isOver && "bg-primary/5 outline-2 outline-dashed outline-primary")}>
      {children}
    </div>
  );
}

export function Builder({
  config,
  onChange,
  onSave,
  onReset,
  saving,
}: {
  config: OnboardingConfig;
  onChange: (c: OnboardingConfig) => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}) {
  const [selStep, setSelStep] = useState<string | null>(config.steps[0]?.id ?? null);
  const [selField, setSelField] = useState<string | null>(null);
  const [device, setDevice] = useState<"mobile" | "desktop">("desktop");
  const [dragType, setDragType] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const selectedStep = config.steps.find((s) => s.id === selStep) ?? null;
  const selectedField = useMemo(() => {
    for (const s of config.steps) {
      const f = s.fields.find((f) => f.id === selField);
      if (f) return { step: s, field: f };
    }
    return null;
  }, [config, selField]);

  const patch = (fn: (c: OnboardingConfig) => OnboardingConfig) => onChange(fn(config));

  const findStepOfField = (fieldId: string): StepConfig | undefined => config.steps.find((s) => s.fields.some((f) => f.id === fieldId));
  const findStepOfOver = (overId: string | undefined): string | null => {
    if (!overId) return null;
    if (overId.startsWith("step:")) return overId.slice(5);
    const st = findStepOfField(overId);
    return st?.id ?? null;
  };

  const handleDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current as { kind: string; fieldType?: string } | undefined;
    setDragType(d?.kind === "new" ? d.fieldType ?? "campo" : "campo");
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDragType(null);
    const { active, over } = e;
    if (!over) return;
    const aData = active.data.current as { kind: string; fieldType?: FieldType; stepId?: string } | undefined;
    const overId = String(over.id);

    // novo campo da paleta → adiciona na etapa de destino
    if (aData?.kind === "new" && aData.fieldType) {
      const targetStepId = findStepOfOver(overId);
      if (!targetStepId) return;
      const nf = { ...newField(aData.fieldType), desktopSpan: 6 as const };
      patch((c) => ({
        ...c,
        steps: c.steps.map((s) => (s.id === targetStepId ? { ...s, fields: [...s.fields, nf] } : s)),
      }));
      setSelStep(targetStepId);
      setSelField(nf.id);
      return;
    }

    // mover/reordenar campo existente
    if (aData?.kind === "field") {
      const fieldId = String(active.id);
      const from = findStepOfField(fieldId);
      const toId = findStepOfOver(overId);
      if (!from || !toId) return;
      patch((c) => {
        const steps = c.steps.map((s) => ({ ...s, fields: [...s.fields] }));
        const fromStep = steps.find((s) => s.id === from.id)!;
        const toStep = steps.find((s) => s.id === toId)!;
        const idx = fromStep.fields.findIndex((f) => f.id === fieldId);
        const [moved] = fromStep.fields.splice(idx, 1);
        if (from.id === toId) {
          const overIdx = toStep.fields.findIndex((f) => f.id === overId);
          toStep.fields.splice(overIdx < 0 ? toStep.fields.length : overIdx, 0, moved);
        } else {
          const overIdx = toStep.fields.findIndex((f) => f.id === overId);
          toStep.fields.splice(overIdx < 0 ? toStep.fields.length : overIdx, 0, moved);
        }
        return { ...c, steps };
      });
    }
  };

  const moveStep = (id: string, dir: -1 | 1) => {
    patch((c) => {
      const i = c.steps.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= c.steps.length) return c;
      const steps = [...c.steps];
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...c, steps };
    });
  };

  const updateField = (fieldId: string, upd: Partial<FieldConfig>) => {
    patch((c) => ({
      ...c,
      steps: c.steps.map((s) => ({ ...s, fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...upd } : f)) })),
    }));
  };

  const updateStep = (stepId: string, upd: Partial<StepConfig>) => {
    patch((c) => ({ ...c, steps: c.steps.map((s) => (s.id === stepId ? { ...s, ...upd } : s)) }));
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "onboarding-config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-3">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              const st = newStep();
              patch((c) => ({ ...c, steps: [...c.steps, st] }));
              setSelStep(st.id);
            }}
            data-testid="builder-add-step"
          >
            <Plus /> Etapa
          </Button>
          <Button size="sm" variant="outline" onClick={onSave} disabled={saving} data-testid="builder-save">
            <Save /> {saving ? "Salvando…" : "Salvar (mock API)"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onReset} data-testid="builder-reset">
            <RotateCcw /> Restaurar padrão
          </Button>
          <Button size="sm" variant="outline" onClick={exportJson} data-testid="builder-export">
            <Download /> Exportar JSON
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setImportOpen((v) => !v)} data-testid="builder-import-toggle">
            <Upload /> Importar
          </Button>
          <span className="ml-auto flex overflow-hidden rounded-lg border" role="group" aria-label="Preview do dispositivo">
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              aria-pressed={device === "mobile"}
              data-testid="preview-mobile"
              className={cn("flex items-center gap-1 px-3 py-1.5 text-sm", device === "mobile" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              <Smartphone className="size-4" /> Mobile
            </button>
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              aria-pressed={device === "desktop"}
              data-testid="preview-desktop"
              className={cn("flex items-center gap-1 px-3 py-1.5 text-sm", device === "desktop" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              <Monitor className="size-4" /> Desktop
            </button>
          </span>
        </div>

        {importOpen && (
          <Card>
            <CardContent className="flex flex-col gap-2 pt-4">
              <Label htmlFor="import-json">Cole o JSON do onboarding</Label>
              <Textarea id="import-json" rows={4} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='{"id": "...", "steps": [...]}' />
              {importError && <Alert tone="error">{importError}</Alert>}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(importText) as OnboardingConfig;
                      if (!parsed.steps || !Array.isArray(parsed.steps)) throw new Error("JSON sem array `steps`.");
                      onChange(parsed);
                      setImportError(null);
                      setImportOpen(false);
                    } catch (err) {
                      setImportError(err instanceof Error ? err.message : "JSON inválido.");
                    }
                  }}
                >
                  Aplicar JSON
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setImportOpen(false)}>
                  Fechar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_1fr_280px]">
          {/* paleta */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Paleta — arraste</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {PALETTE.map((g) => (
                <div key={g.group} className="flex flex-col gap-1.5">
                  <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">{g.group}</p>
                  {g.items.map((p) => (
                    <PaletteItem key={p.type} {...p} />
                  ))}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Arraste um tipo para dentro da etapa desejada. Também dá para clicar em “+ Campo”.</p>
            </CardContent>
          </Card>

          {/* canvas */}
          <div className={cn("flex flex-col gap-3", device === "mobile" && "mx-auto w-full max-w-[400px]")}>
            {device === "mobile" && (
              <div className="rounded-[2rem] border-4 border-foreground/80 p-2">
                <div className="mx-auto mb-2 h-1 w-16 rounded-full bg-muted-foreground/40" aria-hidden />
                <CanvasList
                  config={config}
                  patch={patch}
                  selStep={selStep}
                  selField={selField}
                  setSelStep={setSelStep}
                  setSelField={setSelField}
                  moveStep={moveStep}
                  singleColumn
                />
              </div>
            )}
            {device !== "mobile" && (
              <CanvasList
                config={config}
                patch={patch}
                selStep={selStep}
                selField={selField}
                setSelStep={setSelStep}
                setSelField={setSelField}
                moveStep={moveStep}
              />
            )}
          </div>

          {/* props */}
          <Card className="lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto" data-testid="builder-properties">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Eye className="size-4" /> Propriedades
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!selectedStep && !selectedField && <p className="text-sm text-muted-foreground">Selecione uma etapa ou campo.</p>}
              {selectedStep && !selectedField && (
                <StepProps step={selectedStep} onUpdate={(u) => updateStep(selectedStep.id, u)} />
              )}
              {selectedField && (
                <FieldProps
                  field={selectedField.field}
                  allFields={config.steps.flatMap((s) => s.fields)}
                  onUpdate={(u) => updateField(selectedField.field.id, u)}
                  onClose={() => setSelField(null)}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <DragOverlay>{dragType ? <Badge>Solte na etapa · {dragType}</Badge> : null}</DragOverlay>
    </DndContext>
  );
}

function CanvasList({
  config,
  patch,
  selStep,
  selField,
  setSelStep,
  setSelField,
  moveStep,
  singleColumn = false,
}: {
  config: OnboardingConfig;
  patch: (fn: (c: OnboardingConfig) => OnboardingConfig) => void;
  selStep: string | null;
  selField: string | null;
  setSelStep: (id: string) => void;
  setSelField: (id: string | null) => void;
  moveStep: (id: string, dir: -1 | 1) => void;
  singleColumn?: boolean;
}) {
  return (
    <>
      {config.steps.map((step, si) => (
        <Card key={step.id} data-testid={`builder-step-${step.id}`} className={cn(selStep === step.id && "ring-2 ring-primary/30")}>
          <CardHeader className="flex-row items-center gap-2 pb-2">
            <Badge>{si + 1}</Badge>
            <button type="button" onClick={() => setSelStep(step.id)} className="text-left">
              <CardTitle className="text-base">{step.title}</CardTitle>
            </button>
            <span className="ml-auto flex gap-1">
              <button type="button" aria-label="Mover etapa para cima" onClick={() => moveStep(step.id, -1)} className="rounded p-1 hover:bg-muted">
                <ArrowUp className="size-4" />
              </button>
              <button type="button" aria-label="Mover etapa para baixo" onClick={() => moveStep(step.id, 1)} className="rounded p-1 hover:bg-muted">
                <ArrowDown className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Duplicar etapa"
                onClick={() =>
                  patch((c) => {
                    const i = c.steps.findIndex((s) => s.id === step.id);
                    const copy: StepConfig = { ...step, id: `${step.id}_copy`, title: `${step.title} (cópia)`, fields: step.fields.map((f) => ({ ...f, id: `${f.id}_copy` })) };
                    const steps = [...c.steps];
                    steps.splice(i + 1, 0, copy);
                    return { ...c, steps };
                  })
                }
                className="rounded p-1 hover:bg-muted"
              >
                <Copy className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Excluir etapa"
                onClick={() => patch((c) => ({ ...c, steps: c.steps.filter((s) => s.id !== step.id) }))}
                className="rounded p-1 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4" />
              </button>
            </span>
          </CardHeader>
          <CardContent>
            <StepDropZone step={step}>
              <SortableContext items={step.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className={cn("grid gap-2", singleColumn ? "grid-cols-1" : "grid-cols-1 md:grid-cols-12")}>
                  {step.fields.length === 0 && (
                    <div className="col-span-full rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      Arraste campos da paleta para cá
                    </div>
                  )}
                  {step.fields.map((f) => (
                    <div key={f.id} className={singleColumn ? "" : f.desktopSpan === 12 ? "md:col-span-12" : f.desktopSpan === 8 ? "md:col-span-8" : f.desktopSpan === 4 ? "md:col-span-4" : "md:col-span-6"}>
                      <SortableFieldRow
                        field={f}
                        stepId={step.id}
                        selected={selField === f.id}
                        onSelect={() => {
                          setSelStep(step.id);
                          setSelField(f.id);
                        }}
                        onRemove={() =>
                          patch((c) => ({
                            ...c,
                            steps: c.steps.map((s) => (s.id === step.id ? { ...s, fields: s.fields.filter((x) => x.id !== f.id) } : s)),
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </SortableContext>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const nf = newField("text");
                    patch((c) => ({ ...c, steps: c.steps.map((s) => (s.id === step.id ? { ...s, fields: [...s.fields, nf] } : s)) }));
                    setSelStep(step.id);
                    setSelField(nf.id);
                  }}
                  data-testid={`builder-add-field-${step.id}`}
                >
                  <Plus /> Campo (sem arrastar)
                </Button>
              </div>
            </StepDropZone>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function StepProps({ step, onUpdate }: { step: StepConfig; onUpdate: (u: Partial<StepConfig>) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Etapa</p>
      <Label htmlFor="sp-title">Título</Label>
      <Input id="sp-title" value={step.title} onChange={(e) => onUpdate({ title: e.target.value })} />
      <Label htmlFor="sp-desc">Descrição</Label>
      <Textarea id="sp-desc" rows={2} value={step.description ?? ""} onChange={(e) => onUpdate({ description: e.target.value })} />
      <Label htmlFor="sp-cols">Colunas no desktop</Label>
      <select id="sp-cols" className="h-9 rounded-lg border border-input bg-background px-2 text-sm" value={step.desktopColumns ?? 2} onChange={(e) => onUpdate({ desktopColumns: Number(e.target.value) as 1 | 2 | 3 })}>
        <option value={1}>1 (igual ao mobile)</option>
        <option value={2}>2 (híbrido)</option>
        <option value={3}>3 (denso)</option>
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!step.skippable} onChange={(e) => onUpdate({ skippable: e.target.checked })} className="size-4" />
        Etapa pulável
      </label>
    </div>
  );
}

function FieldProps({
  field,
  allFields,
  onUpdate,
  onClose,
}: {
  field: FieldConfig;
  allFields: FieldConfig[];
  onUpdate: (u: Partial<FieldConfig>) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Campo · {field.type}</p>
        <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:underline">
          voltar p/ etapa
        </button>
      </div>
      <Label htmlFor="fp-id">ID (estável, usado na condicional)</Label>
      <Input id="fp-id" value={field.id} readOnly onFocus={(e) => e.target.select()} />
      <Label htmlFor="fp-label">Rótulo</Label>
      <Input id="fp-label" value={field.label} onChange={(e) => onUpdate({ label: e.target.value })} />
      {field.type !== "info" && field.type !== "heading" && field.type !== "divider" && (
        <>
          <Label htmlFor="fp-ph">Placeholder</Label>
          <Input id="fp-ph" value={field.placeholder ?? ""} onChange={(e) => onUpdate({ placeholder: e.target.value })} />
        </>
      )}
      {(field.type === "info" || field.type === "heading") && (
        <>
          <Label htmlFor="fp-content">{field.type === "heading" ? "Subtítulo" : "Conteúdo"}</Label>
          <Textarea id="fp-content" rows={3} value={field.content ?? ""} onChange={(e) => onUpdate({ content: e.target.value })} />
        </>
      )}
      {field.type === "heading" && (
        <>
          <Label htmlFor="fp-level">Estilo</Label>
          <select
            id="fp-level"
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
            value={field.headingLevel ?? "title"}
            onChange={(e) => onUpdate({ headingLevel: e.target.value as "title" | "subtitle" })}
          >
            <option value="title">Título (grande)</option>
            <option value="subtitle">Subtítulo (discreto)</option>
          </select>
        </>
      )}
      {(field.type === "select" || field.type === "radio" || field.type === "chips" || field.type === "buttons" || field.type === "multiselect") && (
        <>
          <Label htmlFor="fp-opts">Opções (uma por linha: valor|Rótulo)</Label>
          <Textarea
            id="fp-opts"
            rows={4}
            value={(field.options ?? []).map((o) => `${o.value}|${o.label}`).join("\n")}
            onChange={(e) => {
              const options = e.target.value
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
                .map((l) => {
                  const [value, ...rest] = l.split("|");
                  return { value: value.trim(), label: (rest.join("|") || value).trim() };
                });
              onUpdate({ options });
            }}
          />
        </>
      )}
      <Label htmlFor="fp-span">Largura no desktop</Label>
      <select id="fp-span" className="h-9 rounded-lg border border-input bg-background px-2 text-sm" value={field.desktopSpan ?? 12} onChange={(e) => onUpdate({ desktopSpan: Number(e.target.value) as 4 | 6 | 8 | 12 })}>
        <option value={12}>12/12 — linha inteira</option>
        <option value={8}>8/12 — largo</option>
        <option value={6}>6/12 — metade (lado a lado)</option>
        <option value={4}>4/12 — terço (3 colunas)</option>
      </select>
      {field.type !== "info" && field.type !== "heading" && field.type !== "divider" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!field.required} onChange={(e) => onUpdate({ required: e.target.checked })} className="size-4" />
          Obrigatório
        </label>
      )}
      <Label htmlFor="fp-help">Texto de ajuda</Label>
      <Input id="fp-help" value={field.help ?? ""} onChange={(e) => onUpdate({ help: e.target.value })} />
      <Label htmlFor="fp-show">Exibir somente se… (condicional)</Label>
      <select
        id="fp-show"
        className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
        value={field.showIf ? `${field.showIf.field}=${Array.isArray(field.showIf.equals) ? field.showIf.equals[0] : field.showIf.equals}` : ""}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) onUpdate({ showIf: undefined });
          else {
            const [f, val] = v.split("=");
            onUpdate({ showIf: { field: f, equals: val } });
          }
        }}
      >
        <option value="">Sempre visível</option>
        {allFields
          .filter((f) => f.id !== field.id && (f.type === "radio" || f.type === "select"))
          .flatMap((f) => (f.options ?? []).map((o) => ({ f, o })))
          .map(({ f, o }) => (
            <option key={`${f.id}=${o.value}`} value={`${f.id}=${o.value}`}>
              se {f.label} = {o.label}
            </option>
          ))}
      </select>
    </div>
  );
}
