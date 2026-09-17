import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AlertTriangle, ArrowDown, ArrowUp, GitBranch, LayoutList, Link2Off, ListOrdered, Plus, Route, Trash2 } from "lucide-react";
import type { FieldConfig, OnboardingConfig, StepEdge } from "@/onboarding/types";
import { findCycle, resolveNextId } from "@/onboarding/engine";
import { loadDraft, newStep } from "@/mocks/backend";
import { uid } from "@/lib/utils";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Label, Separator } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type StepNodeData = { title: string; order: number; fields: number; selected?: boolean; highlight?: boolean };
type FlowNode = Node<StepNodeData, "step">;
type FlowEdge = Edge;

const CONDITIONABLE: FieldConfig["type"][] = ["radio", "select", "chips", "buttons", "multiselect"];

function edgeLabel(e: StepEdge, fieldsById: Map<string, FieldConfig>): string {
  if (!e.when) return "sempre";
  const f = fieldsById.get(e.when.field);
  const fname = f?.label ?? e.when.field;
  const vals = Array.isArray(e.when.equals) ? e.when.equals : [e.when.equals];
  const names = vals.map((v) => f?.options?.find((o) => o.value === v)?.label ?? v);
  const shown = names.slice(0, 2).join(" ou ") + (names.length > 2 ? ` (+${names.length - 2})` : "");
  return `se ${fname} = ${shown}`;
}

function StepNode({ data }: { data: StepNodeData }) {
  return (
    <div
      data-testid={`flow-node-${data.title}`}
      className={cn(
        "w-52 rounded-xl border bg-card p-3 text-left shadow-sm",
        data.selected && "border-primary ring-2 ring-primary/40",
        data.highlight && "border-green-600 ring-2 ring-green-600/40"
      )}
    >
      <Handle type="target" position={Position.Top} aria-label="entrada" />
      <div className="flex items-center gap-1.5">
        <Badge>{data.order}</Badge>
        <p className="truncate text-sm font-semibold">{data.title}</p>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{data.fields} campo(s) · arraste p/ ligar</p>
      <Handle type="source" position={Position.Bottom} aria-label="saída" />
    </div>
  );
}

const nodeTypes = { step: StepNode };

export function FlowBuilder({
  config,
  onChange,
}: {
  config: OnboardingConfig;
  onChange: (c: OnboardingConfig) => void;
}) {
  const fieldsById = useMemo(() => {
    const m = new Map<string, FieldConfig>();
    for (const s of config.steps) for (const f of s.fields) m.set(f.id, f);
    return m;
  }, [config.steps]);

  const conditionFields = useMemo(
    () => [...fieldsById.values()].filter((f) => (CONDITIONABLE as string[]).includes(f.type) && (f.options?.length ?? 0) > 0),
    [fieldsById]
  );

  const initialNodes: FlowNode[] = useMemo(
    () =>
      config.steps.map((s, i) => ({
        id: s.id,
        type: "step",
        position: config.positions?.[s.id] ?? { x: 220, y: i * 150 },
        data: { title: s.title, order: i + 1, fields: s.fields.length },
        selected: false,
      })),
    // monta do zero a cada abertura da aba (App desmonta ao trocar de tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const initialEdges: FlowEdge[] = useMemo(
    () =>
      (config.edges ?? []).map((e) => ({
        id: e.id,
        source: e.from,
        target: e.to,
        label: edgeLabel(e, fieldsById),
        animated: Boolean(e.when),
      })),
    // idem: snapshot inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [nodes, setNodes] = useState<FlowNode[]>(initialNodes);
  const [edges, setEdges] = useState<FlowEdge[]>(initialEdges);
  const [selEdgeId, setSelEdgeId] = useState<string | null>(null);
  const [previewOn, setPreviewOn] = useState(false);

  // Etapa excluída na aba Campos não pode deixar aresta órfã no grafo
  // (ReactFlow avisa no console e o orphans ficava inconsistente).
  const stepIdSet = useMemo(() => new Set(config.steps.map((s) => s.id)), [config.steps]);
  useEffect(() => {
    const valid = (config.edges ?? []).filter((e) => stepIdSet.has(e.from) && stepIdSet.has(e.to));
    if (valid.length !== (config.edges ?? []).length) {
      onChange({ ...config, edges: valid });
      const keep = new Set(valid.map((e) => e.id));
      setEdges((es) => es.filter((e) => keep.has(e.id)));
      setSelEdgeId((sel) => (sel && keep.has(sel) ? sel : null));
    }
    // roda quando o conjunto de etapas muda (propósito pontual)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdSet]);

  const pushEdges = useCallback(
    (next: FlowEdge[]) => {
      setEdges(next);
      const stepEdges: StepEdge[] = next.map((e) => {
        const prev = (config.edges ?? []).find((p) => p.id === e.id);
        return { id: e.id, from: e.source, to: e.target, when: prev?.when };
      });
      onChange({ ...config, edges: stepEdges });
    },
    [config, onChange]
  );

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns));
  }, []);

  const onEdgesChange = useCallback(
    (changes: EdgeChange<FlowEdge>[]) => {
      setEdges((es) => {
        const next = applyEdgeChanges(changes, es);
        if (changes.some((c) => c.type === "remove")) {
          const keep = new Set(next.map((e) => e.id));
          onChange({ ...config, edges: (config.edges ?? []).filter((e) => keep.has(e.id)) });
          setSelEdgeId((sel) => (sel && keep.has(sel) ? sel : null));
        }
        return next;
      });
    },
    [config, onChange]
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target || conn.source === conn.target) return;
      // ligação duplicada (mesma origem → mesmo destino) só polui o grafo
      if (edges.some((e) => e.source === conn.source && e.target === conn.target)) {
        setSelEdgeId(edges.find((e) => e.source === conn.source && e.target === conn.target)!.id);
        return;
      }
      const id = `e_${uid()}`;
      const next = [...edges, { id, source: conn.source, target: conn.target, label: "sempre" } as FlowEdge];
      pushEdges(next);
      setSelEdgeId(id);
    },
    [edges, pushEdges]
  );

  const onNodeDragStop = useCallback(
    (_event: unknown, node: FlowNode) => {
      onChange({ ...config, positions: { ...(config.positions ?? {}), [node.id]: node.position } });
    },
    [config, onChange]
  );

  const selectedEdge = useMemo(() => (config.edges ?? []).find((e) => e.id === selEdgeId) ?? null, [config.edges, selEdgeId]);

  const setEdgeCondition = useCallback(
    (when: StepEdge["when"]) => {
      if (!selEdgeId) return;
      const stepEdges = (config.edges ?? []).map((e) => (e.id === selEdgeId ? { ...e, when } : e));
      onChange({ ...config, edges: stepEdges });
      setEdges((es) =>
        es.map((e) => (e.id === selEdgeId ? { ...e, label: when ? edgeLabel({ id: e.id, from: e.source, to: e.target, when }, fieldsById) : "sempre", animated: Boolean(when) } : e))
      );
    },
    [selEdgeId, config, onChange, fieldsById]
  );

  const autoLayout = useCallback(() => {
    const next = nodes.map((n, i) => ({ ...n, position: { x: 220, y: i * 150 } }));
    setNodes(next);
    onChange({ ...config, positions: Object.fromEntries(next.map((n) => [n.id, n.position])) });
  }, [nodes, config, onChange]);

  const linearize = useCallback(() => {
    const stepEdges: StepEdge[] = config.steps.slice(0, -1).map((s, i) => ({ id: `e_${uid()}`, from: s.id, to: config.steps[i + 1].id }));
    onChange({ ...config, edges: stepEdges });
    setEdges(stepEdges.map((e) => ({ id: e.id, source: e.from, target: e.to, label: "sempre" })));
  }, [config, onChange]);

  const clearEdges = useCallback(() => {
    onChange({ ...config, edges: [] });
    setEdges([]);
    setSelEdgeId(null);
  }, [config, onChange]);

  const addStepHere = useCallback(() => {
    const st = newStep();
    const pos = { x: 220, y: nodes.length * 150 };
    onChange({
      ...config,
      steps: [...config.steps, st],
      positions: { ...(config.positions ?? {}), [st.id]: pos },
    });
    setNodes((ns) => [
      ...ns,
      { id: st.id, type: "step", position: pos, data: { title: st.title, order: ns.length + 1, fields: 0 }, selected: false },
    ]);
  }, [config, onChange, nodes.length]);

  /** Reordena a prioridade entre saídas do mesmo nó (runtime avalia na ordem). */
  const moveEdge = useCallback(
    (id: string, dir: -1 | 1) => {
      const from = (config.edges ?? []).find((x) => x.id === id)?.from;
      if (!from) return;
      const list = [...(config.edges ?? [])];
      const group = list.map((e, i) => ({ e, i })).filter(({ e }) => e.from === from);
      const pos = group.findIndex(({ e }) => e.id === id);
      const other = group[pos + dir];
      if (!other) return;
      const a = group[pos].i;
      const b = other.i;
      [list[a], list[b]] = [list[b], list[a]];
      onChange({ ...config, edges: list });
      setEdges((es) => {
        const order = new Map(list.map((e, i) => [e.id, i]));
        return [...es].sort((x, y) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0));
      });
    },
    [config, onChange]
  );

  // Preview do caminho com os valores do rascunho atual (aba Testar)
  const previewPath = useMemo(() => {
    if (!previewOn || config.steps.length === 0) return [];
    const vals = loadDraft(config.id);
    const ids: string[] = [];
    const guard = new Set<string>();
    let cur: string | null = config.steps[0].id;
    while (cur && !guard.has(cur)) {
      guard.add(cur);
      ids.push(cur);
      cur = resolveNextId(cur, vals, config.steps, config.edges);
    }
    return ids;
  }, [previewOn, config.id, config.steps, config.edges]);

  const previewLinks = useMemo(() => {
    const s = new Set<string>();
    for (let i = 0; i + 1 < previewPath.length; i++) s.add(`${previewPath[i]}>${previewPath[i + 1]}`);
    return s;
  }, [previewPath]);

  // QA do grafo
  const cycle = useMemo(() => findCycle(config.steps, config.edges), [config.steps, config.edges]);
  const incoming = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of config.steps) m.set(s.id, 0);
    for (const e of config.edges ?? []) m.set(e.to, (m.get(e.to) ?? 0) + 1);
    return m;
  }, [config.steps, config.edges]);
  const orphans = config.steps.filter((s, i) => i > 0 && (incoming.get(s.id) ?? 0) === 0);
  const hasEdges = (config.edges?.length ?? 0) > 0;

  // Ambiguidade: mesma origem com condições idênticas ou múltiplas "sempre" (só a 1ª vale)
  const ambiguity = useMemo(() => {
    const notes: string[] = [];
    const byFrom = new Map<string, StepEdge[]>();
    for (const e of config.edges ?? []) {
      if (!byFrom.has(e.from)) byFrom.set(e.from, []);
      byFrom.get(e.from)!.push(e);
    }
    for (const [from, list] of byFrom) {
      const title = config.steps.find((s) => s.id === from)?.title ?? from;
      const always = list.filter((e) => !e.when);
      if (always.length > 1) notes.push(`“${title}” tem ${always.length} saídas “sempre” — só a primeira será usada.`);
      const seen = new Map<string, string>();
      for (const e of list) {
        if (!e.when) continue;
        const vals = Array.isArray(e.when.equals) ? [...e.when.equals].sort().join(",") : e.when.equals;
        const key = `${e.when.field}=${vals}`;
        if (seen.has(key)) {
          const fname = fieldsById.get(e.when.field)?.label ?? e.when.field;
          notes.push(`“${title}” tem 2 saídas para a mesma condição (${fname} = ${vals}) — só a primeira será usada.`);
        } else seen.set(key, e.id);
      }
    }
    return notes;
  }, [config.edges, config.steps, fieldsById]);

  const condField = selectedEdge?.when ? fieldsById.get(selectedEdge.when.field) : undefined;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_300px]">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <GitBranch className="size-4" /> Fluxo — ligue os nós conforme as respostas
          </CardTitle>
          <span className="ml-auto flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={addStepHere} data-testid="flow-add-step">
              <Plus /> Etapa
            </Button>
            <Button
              size="sm"
              variant={previewOn ? "default" : "outline"}
              onClick={() => setPreviewOn((v) => !v)}
              aria-pressed={previewOn}
              data-testid="flow-preview"
            >
              <Route /> {previewOn ? "Ocultar caminho" : "Pré-visualizar caminho"}
            </Button>
            <Button size="sm" variant="outline" onClick={autoLayout} data-testid="flow-layout">
              <LayoutList /> Organizar
            </Button>
            <Button size="sm" variant="outline" onClick={linearize} data-testid="flow-linear">
              <ListOrdered /> Fluxo linear
            </Button>
            <Button size="sm" variant="ghost" onClick={clearEdges} data-testid="flow-clear">
              <Link2Off /> Limpar
            </Button>
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {cycle && (
            <Alert tone="error" data-testid="flow-cycle">
              <span className="flex items-center gap-1.5 font-medium"><AlertTriangle className="size-4" /> Ciclo detectado: {cycle.map((id) => config.steps.find((s) => s.id === id)?.title ?? id).join(" → ")}</span>
              <span className="block">O runtime seguiria em loop — remova uma ligação do ciclo.</span>
            </Alert>
          )}
          {!hasEdges && (
            <Alert tone="info">
              Sem ligações = fluxo <strong>linear</strong> (ordem das etapas). Arraste da alça inferior de um nó até o topo de outro para criar um desvio.
            </Alert>
          )}
          {hasEdges && orphans.length > 0 && (
            <Alert tone="error" data-testid="flow-orphans">
              Etapas inalcançáveis (sem ligação de entrada): {orphans.map((s) => s.title).join(", ")}.
            </Alert>
          )}
          {ambiguity.length > 0 && (
            <Alert tone="error" data-testid="flow-ambiguity">
              {ambiguity.map((a) => (
                <span key={a} className="block">• {a}</span>
              ))}
            </Alert>
          )}
          {previewOn && (
            <Alert tone="success" data-testid="flow-preview-path">
              Caminho com o rascunho atual: {previewPath.map((id) => config.steps.find((s) => s.id === id)?.title ?? id).join(" → ") || "—"}
              {" "}· Preencha respostas na aba Testar e volte aqui para ver o desvio acender em verde.
            </Alert>
          )}
          <div className="h-[420px] overflow-hidden rounded-xl border md:h-[560px]" data-testid="flow-canvas">
            <ReactFlow
              nodes={nodes.map((n) => ({
                ...n,
                data: { ...n.data, selected: n.selected, highlight: previewOn && previewPath.includes(n.id) },
              }))}
              edges={edges.map((e) =>
                previewOn && previewLinks.has(`${e.source}>${e.target}`)
                  ? { ...e, animated: true, style: { ...(e.style ?? {}), stroke: "#16a34a", strokeWidth: 3 } }
                  : e
              )}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDragStop={onNodeDragStop}
              onSelectionChange={({ edges: sel }) => setSelEdgeId(sel[0]?.id ?? null)}
              fitView
              proOptions={{ hideAttribution: true }}
              aria-label="Editor de fluxo do onboarding"
            >
              <Background />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </div>
          <p className="text-xs text-muted-foreground">
            Aresta <strong>sólida</strong> = “sempre”; <strong>animada + rótulo</strong> = condicional (avaliada primeiro). Etapa sem saída usa o próximo passo linear. Clique numa aresta para editar a condição ao lado.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ligação selecionada</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!selectedEdge && <p className="text-sm text-muted-foreground">Clique numa aresta do canvas para definir “de acordo com a resposta”.</p>}
          {selectedEdge && (
            <>
              <p className="text-sm">
                <Badge>{config.steps.find((s) => s.id === selectedEdge.from)?.title}</Badge>
                <span className="mx-1.5 text-muted-foreground">→</span>
                <Badge>{config.steps.find((s) => s.id === selectedEdge.to)?.title}</Badge>
              </p>
              <Label htmlFor="edge-kind">Regra</Label>
              <select
                id="edge-kind"
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                value={selectedEdge.when ? "when" : "always"}
                onChange={(e) => {
                  if (e.target.value === "always") setEdgeCondition(undefined);
                  else {
                    const f = conditionFields[0];
                    if (f) setEdgeCondition({ field: f.id, equals: f.options![0].value });
                  }
                }}
              >
                <option value="always">Sempre seguir</option>
                <option value="when">Somente se a resposta for…</option>
              </select>
              {selectedEdge.when && (
                <>
                  <Label htmlFor="edge-field">Campo (resposta)</Label>
                  <select
                    id="edge-field"
                    className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                    value={selectedEdge.when.field}
                    onChange={(e) => {
                      const f = fieldsById.get(e.target.value);
                      setEdgeCondition({ field: e.target.value, equals: f?.options?.[0]?.value ?? "" });
                    }}
                  >
                    {conditionFields.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                  <Label htmlFor="edge-value">Valor(es) — qualquer um deles ativa a saída</Label>
                  <div id="edge-value" className="flex flex-col gap-1.5" role="group" aria-label="Valores que ativam a saída">
                    {condField?.options?.map((o) => {
                      const vals = selectedEdge.when && Array.isArray(selectedEdge.when.equals)
                        ? selectedEdge.when.equals
                        : selectedEdge.when
                          ? [selectedEdge.when.equals as string]
                          : [];
                      const checked = vals.includes(o.value);
                      return (
                        <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm hover:bg-muted">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (!selectedEdge.when) return;
                              const next = checked ? vals.filter((v) => v !== o.value) : [...vals, o.value];
                              if (next.length === 0) return; // mantém ao menos 1 valor
                              setEdgeCondition({ ...selectedEdge.when, equals: next.length === 1 ? next[0] : next });
                            }}
                            className="size-4"
                          />
                          {o.label}
                        </label>
                      );
                    })}
                  </div>
                  {conditionFields.length === 0 && (
                    <Alert tone="error">Nenhum campo de resposta (botões, rádio, select, múltipla escolha ou chips com opções) nas etapas — crie um na aba Campos.</Alert>
                  )}
                </>
              )}
              <Separator />
              {(() => {
                const siblings = (config.edges ?? []).filter((e) => e.from === selectedEdge.from);
                if (siblings.length < 2) return null;
                const pos = siblings.findIndex((e) => e.id === selectedEdge.id);
                return (
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-muted-foreground">
                      Prioridade {pos + 1}ª de {siblings.length} saídas
                    </span>
                    <span className="ml-auto flex gap-1">
                      <button
                        type="button"
                        aria-label="Aumentar prioridade"
                        onClick={() => moveEdge(selectedEdge.id, -1)}
                        disabled={pos === 0}
                        className="rounded p-1 hover:bg-muted disabled:opacity-40"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Diminuir prioridade"
                        onClick={() => moveEdge(selectedEdge.id, 1)}
                        disabled={pos === siblings.length - 1}
                        className="rounded p-1 hover:bg-muted disabled:opacity-40"
                      >
                        <ArrowDown className="size-4" />
                      </button>
                    </span>
                  </div>
                );
              })()}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  const id = selEdgeId;
                  setEdges((es) => es.filter((e) => e.id !== id));
                  onChange({ ...config, edges: (config.edges ?? []).filter((e) => e.id !== id) });
                  setSelEdgeId(null);
                }}
                data-testid="flow-delete-edge"
              >
                <Trash2 /> Excluir ligação
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
