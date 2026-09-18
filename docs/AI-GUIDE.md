# Guia para Agentes de IA

## Visão Geral

Este projeto é uma POC de onboarding modular com:
- **Runtime**: formulário multi-etapa com validação Zod
- **Builder**: editor visual arrasta-e-solta
- **Flow**: grafo condicional com React Flow
- **Backend**: mock com localStorage

## Regras Importantes

### 1. Persistência

- **NUNCA** re-seed após deletar tudo — use `resetOnboardingConfig()`
- Rascunhos ficam em `poc-onboarding-draft:<id>`
- Migração one-shot do legado já foi feita (não duplicar)
- Coleção em `poc-onboardings`

### 2. Validação

- Fonte única: `src/onboarding/schema.ts`
- `validateWithSchema` para um campo
- `validateStepFields` para uma etapa (só campos visíveis)
- `isFieldVisible` verifica `showIf` com valores reais
- Mensagens em PT-BR, espelhando contratos de teste

### 3. Estilo

- Tailwind v4 com `@custom-variant dark`
- Primitivos manuais (sem shadcn CLI)
- `cn()` para merge de classes (tailwind-merge + clsx)
- Tokens semânticos oklch em `src/index.css`

### 4. Testes

- **55 testes unitários**: `npm test`
- **16 E2E**: `npm run test:browser`
- **Contraste**: `npm run test:contrast`
- **Tudo deve passar** antes de commit

### 5. Git

- Usar conta do usuário (verificar `git config user.email`)
- Convention commits: `feat:`, `fix:`, `docs:`, `refactor:`, etc.
- Incluir `co-authored-by` quando aplicável
- **NUNCA** sobrescrever config git do usuário

## Estrutura de Arquivos

### Onde editar o quê

| Necessidade | Arquivo |
|---|---|
| Adicionar tipo de campo | `src/onboarding/fields.tsx` + `types.ts` + `schema.ts` |
| Mudar validação | `src/onboarding/schema.ts` |
| Alterar fluxo de navegação | `src/onboarding/engine.tsx` |
| Modificar layout do Runtime | `src/onboarding/Runtime.tsx` |
| Editar Builder | `src/builder/Builder.tsx` |
| Editar Flow | `src/flow/FlowBuilder.tsx` |
| Adicionar API mock | `src/mocks/backend.ts` |
| Mudar tema | `src/index.css` + `src/theme/ThemeProvider.tsx` |
| Adicionar teste unitário | `src/**/*.test.ts` |
| Adicionar teste E2E | `qa/smoke-chrome.cjs` |

### Padrões de Código

```typescript
// Componentes: function declarations
export function MyComponent({ prop }: { prop: string }) {
  return <div>{prop}</div>;
}

// Hooks: use prefix
export function useMyHook() {
  return useContext(MyContext);
}

// Utilitários: function declarations
export function myUtil(param: string): number {
  return param.length;
}
```

### Imports

```typescript
// Alias @/ para src/
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/primitives";
import type { FieldConfig } from "@/onboarding/types";
```

## Comandos Úteis

```bash
# Desenvolvimento
npm run dev              # Dev server na 5174
npm run build            # Build de produção
npm run lint             # Lint com oxlint

# Testes
npm test                 # Unitários (55)
npm run test:browser     # E2E smoke (16)
npm run test:contrast    # WCAG contrast
npm run test:themes      # Screenshots

# Git
git status               # Ver alterações
git diff                 # Ver diff
git log --oneline -5     # Últimos commits
```

## Debug

### Chrome DevTools MCP

```javascript
// Abrir página
await chrome_devtools_new_page({ url: "http://localhost:5174/onboardings" });

// Snapshot
await chrome_devtools_take_snapshot({ pageId: 1 });

// Screenshot
await chrome_devtools_take_screenshot({ pageId: 1 });

// Console
await chrome_devtools_list_console_messages({ pageId: 1 });

// Network
await chrome_devtools_list_network_requests({ pageId: 1 });
```

### localStorage

```javascript
// Ver coleção
JSON.parse(localStorage.getItem("poc-onboardings"))

// Ver rascunho
JSON.parse(localStorage.getItem("poc-onboarding-draft:onboarding-poc-v1"))

// Ver tema
localStorage.getItem("poc-theme")
```

## Erros Comuns

### "Cannot find module '@/...'"

Verificar `tsconfig.app.json` tem `paths: { "@/*": ["./src/*"] }`.

### Tailwind classes não funcionam

Verificar `src/index.css` tem `@import "tailwindcss"` e `@custom-variant dark`.

### Build falha

1. `npm run lint` — ver erros de tipo
2. Verificar imports are correct
3. Verificar que todos os tipos estão exportados

### Testes E2E falham

1. Verificar dev server rodando na 5174
2. Verificar Chrome instalado
3. `npm run test:browser` — ver output detalhado

## Fluxo de Trabalho Recomendado

1. **Entender** o que precisa ser feito
2. **Localizar** os arquivos relevantes
3. **Implementar** a mudança
4. **Testar** localmente (`npm test` + `npm run build`)
5. **Verificar** visualmente no browser
6. **Commit** com mensagem clara
7. **Push** para o repositório

## Contato

- Repo: `https://github.com/gustavomssell/POC-Onboarding`
- Issues: usar GitHub Issues
