# POC · Onboarding Studio

Editor visual multi-onboarding com builder arrasta-e-solta, fluxo condicional em grafo e runtime mobile/desktop. Sem backend real — `src/mocks/backend.ts` simula latência e endpoints.

## Quick Start

```bash
npm install
npm run dev        # http://localhost:5174
npm test           # 55 testes unitários (utils, engine, backend)
npm run build      # tsc + vite build
npm run lint       # oxlint
```

## Scripts de QA

| Comando | Descrição | Requisitos |
|---|---|---|
| `npm run test:browser` | Smoke E2E (16 cenários, Chrome real) | `playwright-core` + Chrome |
| `npm run test:mcp` | Drive via MCP (4 cenários) | chrome-devtools-mcp |
| `npm run test:themes` | Screenshots light/dark (4 combos) | Chrome headless |
| `npm run test:contrast` | Auditoria WCAG contrast + footer | Chrome headless |

## Arquitetura

### Rotas (`src/router.tsx`)

| Rota | Página |
|---|---|
| `/` | Redirect → `/onboardings` |
| `/onboardings` | Lista de onboardings (CRUD) |
| `/onboardings/:id` | Redirect → `:id/campos` |
| `/onboardings/:id/:mode` | Editor (`testar` \| `campos` \| `fluxo`) |
| `*` | NotFound |

### Módulos Principais

| Módulo | Caminho | Responsabilidade |
|---|---|---|
| **Onboarding Engine** | `src/onboarding/engine.tsx` | Provider, useForm, validação, path, draft, submit |
| **Schema** | `src/onboarding/schema.ts` | Zod validation, isFieldVisible, validateStepFields |
| **Fields** | `src/onboarding/fields.tsx` | 21 tipos de campo, DynamicField, spanClass |
| **Runtime** | `src/onboarding/Runtime.tsx` | Stepper, transições, footer, tela sucesso |
| **Types** | `src/onboarding/types.ts` | OnboardingConfig, FieldConfig, StepEdge, Values |
| **Builder** | `src/builder/Builder.tsx` | Paleta, canvas, propriedades, drag-and-drop |
| **FlowBuilder** | `src/flow/FlowBuilder.tsx` | React Flow, arestas condicionais, preview |
| **Backend Mock** | `src/mocks/backend.ts` | CRUD, drafts, CEP, submit, versionamento |
| **Primitives** | `src/components/ui/primitives.tsx` | Button, Card, Input, Badge, Alert, etc. |
| **Theme** | `src/theme/ThemeProvider.tsx` | Dark/light/sistema, persistência localStorage |
| **Router** | `src/router.tsx` | React Router, lazy loading |

### Fluxo de Dados

```
User Input → Runtime (useForm/useWatch) → validateStepFields (Zod)
    ↓
resolveNextId (edges condicionais → always → linear)
    ↓
path[] atualizado → stepper re-render → draft persistido (localStorage)
    ↓
submit → submitOnboarding → tela sucesso com protocolo
```

## Tipos de Campo (21)

| Grupo | Tipos |
|---|---|
| Texto e números | `text`, `email`, `password`, `tel`, `number`, `integer`, `currency`, `percent`, `document`, `date`, `textarea` |
| Escolha | `buttons`, `radio`, `select`, `multiselect`, `chips`, `checkbox`, `switch` |
| Conteúdo | `heading`, `divider`, `info` |

### Validação por Tipo

| Tipo | Validação |
|---|---|
| `email` | Regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` |
| `integer` | Regex `^-?\d+$` |
| `percent` | 0–100 (parseBR) |
| `currency` | parseBR (R$) |
| `document` | 11 ou 14 dígitos (CPF/CNPJ) |
| `checkbox`/`switch` | Boolean, required = true |
| `chips`/`multiselect` | Array de strings |
| `*` (outros) | String, minLength opcional |

## Fluxo Condicional (Grafo)

O engine resolve o próximo passo nesta ordem:

1. **Arestas condicionais** (na ordem do array) cuja `when` bate com as respostas
2. **Primeira aresta "sempre"** (sem `when`) — fallback
3. **Próximo passo linear** — se não há arestas

```typescript
// Exemplo de StepEdge
{ id: "e1", from: "welcome", to: "account", when: { field: "account_kind", equals: "pf" } }
{ id: "e2", from: "welcome", to: "company", when: { field: "account_kind", equals: "pj" } }
```

## Persistência

| Chave localStorage | Conteúdo |
|---|---|
| `poc-onboardings` | Coleção de configs `OnboardingConfig[]` |
| `poc-onboarding-draft:<id>` | Rascunho do usuário por onboarding |
| `poc-theme` | Tema selecionado (light/dark/sistema) |

Migração one-shot do legado `poc-onboarding-config` / `poc-onboarding-draft`.

## Tema

- Toggle **Claro / Escuro / Sistema** no header
- Tailwind v4 com `@custom-variant dark` (classe `.dark`)
- Tokens semânticos oklch em `src/index.css`
- Contraste verificado: `npm run test:contrast` (WCAG AA ≥4.5)
- `prefers-reduced-motion` zera animações

## responsividade

| | Mobile (<768px) | Desktop (≥768px) |
|---|---|---|
| Layout | 1 etapa/tela, 1 coluna | Grid 12: `desktopSpan` 4/6/8/12 |
| Stepper | Pills compactas (nº) | Pills com título |
| Builder | Frame celular 400px | Largura total |
| Propriedades | No fluxo normal | Sticky (`lg:sticky`) |

## Boas Práticas

- Validação inline PT-BR com `aria-invalid` + `role=alert`
- LGPD explícita, microcopy de rascunho, estados loading/erro/vazio/sucesso
- Teclado: paleta e campos operáveis sem mouse
- `data-testid` em pontos-chave para testes E2E
- `co-authored-by` em commits (GitFlow)

## Limitações

- Persistência é `localStorage` (multi-aba não sincroniza)
- Sem i18n (só PT-BR)
- Backend é mock (troca por `fetch` real sem mexer em engine/UI)
- shadcn CLI falha no Windows neste template (primitivos manuais)

## Docs

- [Arquitetura](docs/ARCHITECTURE.md) — Estrutura detalhada do sistema + diagramas Mermaid
- [Tipos de Campo](docs/FIELDS.md) — 21 tipos com exemplos e validação
- [QA e Testes](docs/QA.md) — Guia completo de testes
- [UI/UX](docs/UI-UX.md) — Design system, tokens, componentes
- [Guia para IA](docs/AI-GUIDE.md) — Instruções para agentes de IA
