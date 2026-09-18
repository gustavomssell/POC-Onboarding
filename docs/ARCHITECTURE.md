# Arquitetura do Sistema

## Diagrama de Alto Nível

```mermaid
graph TB
    subgraph "Frontend"
        A[App.tsx] --> B[Router]
        B --> C[OnboardingListPage]
        B --> D[OnboardingEditorPage]
        D --> E[Runtime]
        D --> F[Builder]
        D --> G[FlowBuilder]
    end

    subgraph "Core"
        E --> H[OnboardingProvider]
        H --> I[useForm]
        H --> J[resolveNextId]
        H --> K[validateStepFields]
        F --> L[dnd-kit]
        G --> M[React Flow]
    end

    subgraph "Data"
        H --> N[Backend Mock]
        N --> O[localStorage]
        I --> P[Zod Schema]
        K --> P
    end

    subgraph "UI"
        E --> Q[DynamicField]
        F --> Q
        Q --> R[21 Field Types]
    end

    style A fill:#e1f5fe
    style H fill:#f3e5f5
    style N fill:#e8f5e8
    style Q fill:#fff3e0
```

## Fluxo de Dados

```mermaid
sequenceDiagram
    participant U as User
    participant R as Runtime
    participant E as Engine
    participant S as Schema
    participant B as Backend

    U->>R: Input em campo
    R->>E: onChange(value)
    E->>B: persistDraft(id, values)
    B->>B: localStorage.setItem()

    U->>R: Clica "Continuar"
    R->>E: next()
    E->>S: validateStepFields(fields, values)
    S-->>E: errors ou vazio

    alt Sem erros
        E->>E: resolveNextId(currentId, values, steps, edges)
        E->>E: path.push(nextId)
        E-->>R: Renderiza próxima etapa
    else Com erros
        E-->>R: Mostra erros inline
    end

    U->>R: Clica "Enviar" (última etapa)
    R->>E: submit()
    E->>B: submitOnboarding(id, values)
    B->>B: localStorage.removeItem(draftKey)
    B-->>E: { protocol: "POC-XXXXXX" }
    E-->>R: Tela de sucesso
```

## Dependency Graph

```mermaid
graph LR
    subgraph "Pages"
        A[OnboardingListPage]
        B[OnboardingEditorPage]
    end

    subgraph "Features"
        C[Runtime]
        D[Builder]
        E[FlowBuilder]
    end

    subgraph "Core"
        F[Engine]
        G[Schema]
        H[Fields]
        I[Types]
    end

    subgraph "Infrastructure"
        J[Backend Mock]
        K[Primitives]
        L[ThemeProvider]
    end

    A --> J
    B --> C
    B --> D
    B --> E
    C --> F
    C --> H
    D --> H
    D --> J
    E --> F
    F --> G
    F --> J
    H --> I
    H --> K
    G --> I
    J --> I
    K --> L

    style F fill:#f3e5f5
    style G fill:#e8f5e8
    style H fill:#fff3e0
    style J fill:#e1f5fe
```

## Visão Geral

```
src/
├── App.tsx                    # Shell (header + outlet + footer)
├── main.tsx                   # Entry point + RouterProvider
├── router.tsx                 # Rotas lazy-loaded
├── index.css                  # Tokens, theme, React Flow vars
│
├── onboarding/                # Core do onboarding
│   ├── types.ts               # Tipos: OnboardingConfig, FieldConfig, StepEdge
│   ├── schema.ts              # Zod: validateWithSchema, isFieldVisible
│   ├── engine.tsx             # Provider: useForm, path, resolveNextId, draft
│   ├── fields.tsx             # DynamicField (21 tipos), spanClass
│   └── Runtime.tsx            # Stepper, transições, footer, sucesso
│
├── builder/                   # Editor visual
│   └── Builder.tsx            # Paleta, canvas, propriedades, DnD
│
├── flow/                      # Fluxo em grafo
│   └── FlowBuilder.tsx        # React Flow, arestas condicionais
│
├── mocks/                     # Backend mock
│   ├── backend.ts             # CRUD, drafts, CEP, submit
│   └── backend.test.ts        # 32 testes do repositório
│
├── pages/                     # Páginas de rota
│   ├── OnboardingListPage.tsx # Lista, modal criação, exclusão
│   └── OnboardingEditorPage.tsx # Editor com abas
│
├── components/ui/             # Primitivos de UI
│   └── primitives.tsx         # Button, Card, Input, Badge, Alert, etc.
│
├── theme/                     # Tema
│   └── ThemeProvider.tsx       # Dark/light/sistema, persistência
│
└── lib/                       # Utilitários
    ├── utils.ts               # cn(), parseBR(), uid(), masks
    └── utils.test.ts          # 3 testes de máscaras
```

## Dependency Graph

```
router.tsx
  └─ App.tsx (shell)
       ├─ OnboardingListPage.tsx
       │    └─ backend.ts (CRUD)
       └─ OnboardingEditorPage.tsx
            ├─ Builder.tsx
            │    ├─ fields.tsx (DynamicField)
            │    ├─ backend.ts (save/load)
            │    └─ dnd-kit (drag-and-drop)
            ├─ FlowBuilder.tsx (lazy)
            │    ├─ @xyflow/react
            │    └─ engine.tsx (findCycle)
            └─ Runtime.tsx
                 ├─ engine.tsx (OnboardingProvider)
                 │    ├─ useForm (react-hook-form)
                 │    ├─ schema.ts (validateStepFields)
                 │    └─ backend.ts (draft/submit)
                 └─ fields.tsx (DynamicField)
```

## Data Flow

### 1. Carregamento

```
localStorage → readCollection() → OnboardingConfig[]
    ↓
OnboardingEditorPage → fetchOnboardingConfig(id)
    ↓
OnboardingProvider → useForm({ defaultValues })
    ↓
Runtime renderiza campos via Controller/FieldControl
```

### 2. Validação

```
User input → useWatch (react-hook-form)
    ↓
onChange → persistDraft (localStorage)
    ↓
Continuar → validateStepFields(fields, values)
    ↓
errors vazios → resolveNextId(currentId, values, steps, edges)
    ↓
path.push(nextId) → stepper atualiza
```

### 3. Submissão

```
Etapa final → validateStepFields (todos os campos visitados)
    ↓
submitOnboarding(config.id, values)
    ↓
localStorage.removeItem(draftKey)
    ↓
Tela sucesso com protocolo POC-XXXXXX
```

## Engine: resolveNextId

```typescript
function resolveNextId(currentId, values, steps, edges): string | null {
  // 1. Arestas condicionais (na ordem) que batem
  for (const edge of conditionalEdges) {
    if (whenMatches(edge.when, values)) return edge.to;
  }
  
  // 2. Primeira aresta "sempre"
  const always = edges.find(e => !e.when);
  if (always) return always.to;
  
  // 3. Fallback linear
  const idx = steps.findIndex(s => s.id === currentId);
  return steps[idx + 1]?.id ?? null;
}
```

## Builder: Estrutura

```
Builder
├── Toolbar (Etapa, Salvar, Restaurar, Exportar, Importar, Toggle Device)
├── Grid 3 colunas
│   ├── Paleta (21 tipos em 3 grupos)
│   ├── Canvas
│   │   ├── Mobile: frame 400px com DeviceFrame
│   │   └── Desktop: largura total
│   │       └── CanvasList
│   │           └── SortableFieldRow (por etapa)
│   │               └── DynamicField (preview disabled)
│   └── Propriedades (lg:sticky)
│       ├── StepProps (título, descrição, colunas, skippable)
│       └── FieldProps (label, placeholder, opções, showIf, etc.)
```

## Backend Mock: API

| Função | Método | Descrição |
|---|---|---|
| `listOnboardings()` | GET | Retorna coleção |
| `createOnboarding(title)` | POST | Cria novo com ID único |
| `deleteOnboarding(id)` | DELETE | Remove da coleção |
| `fetchOnboardingConfig(id?)` | GET | Busca config por ID |
| `saveOnboardingConfig(config)` | PUT | Salva com version+1 |
| `resetOnboardingConfig(id?)` | PUT | Restaura padrão |
| `submitOnboarding(id, values)` | POST | Simula envio (erro se "erro" no e-mail) |
| `lookupCep(cep)` | GET | Mock ViaCEP |
| `checkEmailAvailable(email)` | GET | Sempre true |
| `loadDraft(id)` | GET | Rascunho do usuário |
| `persistDraft(id, values)` | PUT | Salva rascunho |

## State Management

- **react-hook-form** para formulário (useForm + useWatch)
- **useState** local para UI state (selStep, selField, device, etc.)
- **localStorage** para persistência (config, drafts, theme)
- **React Context** para OnboardingProvider (engine)
- Sem Redux/Zustand — estado é local e derivado

## Bundle

| Chunk | Tamanho | Conteúdo |
|---|---|---|
| `index.js` | ~355 kB | React, ReactDOM, utils |
| `OnboardingEditorPage.js` | ~162 kB | Editor completo |
| `FlowBuilder.js` | ~192 kB | React Flow (lazy) |
| `Builder.js` | ~65 kB | Builder + DnD |
| `index.css` | ~34 kB | Tailwind + tokens |

Total: ~808 kB ( gzip ~241 kB )
