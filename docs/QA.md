# QA e Testes

## Visão Geral

| Suite | Comando | Tipo | Cobertura |
|---|---|---|---|
| Unitários | `npm test` | Vitest | 55 testes (utils 3, engine 20, backend 32) |
| Smoke E2E | `npm run test:browser` | Playwright + Chrome | 16 cenários |
| Management | (via smoke) | Playwright + Chrome | 15 cenários |
| Branching | (via smoke) | Playwright + Chrome | 4 caminhos |
| Preview Toggle | (via smoke) | Playwright + Chrome | 5 cenários |
| Contrast | `npm run test:contrast` | Playwright + Chrome | WCAG AA |
| Themes | `npm run test:themes` | Playwright + Chrome | 4 screenshots |
| MCP Drive | `npm run test:mcp` | chrome-devtools-mcp | 4 cenários |

## Testes Unitários

### utils.test.ts (3 testes)

- `parseBR` — parse de moeda BR (5000000 → 5000000.00)
- `onlyDigits` — remove não-dígitos
- `uid` — gera IDs únicos

### engine.test.ts (20 testes)

| Categoria | Testes | O que valida |
|---|---|---|
| Visibilidade | 3 | showIf com string, array, vazio |
| Validação | 6 | required, email, minLength, integer, percent, document |
| resolveNextId | 5 | condicional, always, linear, destino fantasma, self-loop |
| Ciclo | 1 | detecção de ciclo no grafo |
| Regressão | 2 | condicionais obrigatórios (bug fix) |
| Validation skip | 3 | campos ocultos não são validados |

### backend.test.ts (32 testes)

| Categoria | Testes | O que valida |
|---|---|---|
| CRUD | 4 | create, update, delete, list |
| Isolamento | 3 | drafts por ID, não interferem entre si |
| Migração | 2 | legado → nova coleção (one-shot) |
| Validação | 5 | config corrompido, coleção inválida |
| Concorrência | 2 | mutações simultâneas preservam dados |
| Rascunho | 3 | load, persist, submit limpa draft |
| Versão | 2 | save incrementa version |
| Reset | 2 | reset preserva ID, limpa campos |

## Smoke E2E (qa/smoke-chrome.cjs)

### Setup

```bash
npm run dev -- --port 5174
npm run test:browser
# ou: PORT=5173 npm run test:browser
```

### Cenários (16)

1. **App carrega** — config padrão, etapa 1/6
2. **Validação bloqueia** — avanço sem escolher perfil
3. **PJ mostra condicionais** — Razão social/CNPJ, esconde CPF
4. **Preenche conta** — name, email, password, phone, company, cnpj
5. **Rascunho restaura** — reload mantém valores
6. **Voltar preserva** — back e forward mantêm dados
7. **Objetivo + perfil** — botões avançam para endereço
8. **CEP mock** — preenche cidade/UF/rua
9. **Prefs → plano** — enterprise mostra seats/moeda/%
10. **LGPD bloqueia** — submit sem aceite retorna erro
11. **Submit sucesso** — protocolo POC-XXXXXX
12. **Reset limpa** — valores e erros, draft preservado
13. **Builder paleta** — abas e campos agrupados
14. **Builder preview** — mobile frame
15. **Flow renderiza** — 6 nós
16. **Mobile 390px** — 1 coluna

### data-testid Principais

| Componente | testid |
|---|---|
| Step counter | `step-counter` |
| Botão avançar | `btn-next` |
| Botão voltar | `btn-back` |
| Botão enviar | `btn-submit` |
| Botão pular | `btn-skip` |
| Input específico | `input-{fieldId}` |
| Campo específico | `field-{fieldId}` |
| Tab runtime | `tab-runtime` |
| Tab builder | `tab-builder` |
| Tab flow | `tab-flow` |
| Preview mobile | `preview-mobile` |
| Preview desktop | `preview-desktop` |
| Builder propriedades | `builder-properties` |
| Tela sucesso | `success-screen` |

## Contrast (qa/contrast.cjs)

### Setup

```bash
npm run dev -- --port 5174
npm run test:contrast
```

### O que verifica

- **Corpo**: contraste ≥4.5 (WCAG AA)
- **Muted text**: contraste ≥4.5
- **Botão Continuar**: contraste ≥4.5
- **Footer**: grudado no final (flex-col min-h-svh + main flex-1)

### Valores atuais (oklch → sRGB)

| Tema | Corpo | Muted | Botão |
|---|---|---|---|
| Light | 19.8 | 4.74 | 17.18 |
| Dark | 18.97 | 7.66 | 14.23 |

⚠️ `muted` no light (4.74) passa no limite do AA — não escurecer sem re-testar.

## Preview Toggle (qa/preview-toggle.cjs)

### Cenários (5)

1. **Toggle existe** — Desktop pressionado por padrão
2. **Desktop viewport largo** — 12 colunas, stepper visível
3. **Mobile viewport largo** — Moldura ~418px, 1 coluna, stepper oculto
4. **Container queries** — sm:/md: respondem ao FRAME, não à janela
5. **Toggle N vezes** — Estado consistente após alternâncias

## MCP Drive (qa/mcp-drive.cjs)

### Setup

```bash
npm run dev -- --port 5174
npm run test:mcp
```

### Cenários (4)

1. **Erro sem LGPD** — Clica Continuar, confere erro inline
2. **PJ + LGPD** — Marca PJ, confere etapa Conta
3. **Console limpo** — Zero erros via list_console_messages
4. **Network sem falhas** — list_network_requests OK

## Como Adicionar Novos Testes

### Unitário

```typescript
// src/onboarding/engine.test.ts
it("descreve o que é testado", () => {
  // arrange
  const steps = [...];
  const edges = [...];
  
  // act
  const result = resolveNextId("welcome", { account_kind: "pf" }, steps, edges);
  
  // assert
  expect(result).toBe("account");
});
```

### E2E (Smoke)

```javascript
// qa/smoke-chrome.cjs
await step("descrição do cenário", async () => {
  // arrange
  await page.goto(RUNTIME);
  
  // act
  await page.getByTestId("btn-next").click();
  
  // assert
  await page.getByTestId("step-form-account").waitFor();
});
```

### Management

```javascript
// qa/management.cjs — cada step cria um novo context
await step("nome do cenário", async (page) => {
  await openList(page);
  // ...ações e asserts...
}, { viewport: { width: 1366, height: 900 } });
```

## CI/CD

### Checklist Pré-Commit

```bash
npm run build          # 1. TypeScript + Vite build
npm run lint           # 2. oxlint (0 erros, 12 avisos preexistentes)
npm test               # 3. 55 testes unitários
npm run test:browser   # 4. 16 cenários E2E
npm run test:contrast  # 5. WCAG contrast
```

### Ordem Recomendada

1. `npm test` — rápido, catcha erros lógicos
2. `npm run build` — catcha erros de tipo
3. `npm run test:browser` — catcha erros de integração
4. `npm run test:contrast` — catcha problemas de acessibilidade
