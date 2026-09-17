# POC · Onboarding modular e adaptável (mobile/desktop) + Builder arrasta-e-solta

Stack: **React + TS + Vite + Tailwind v4 + shadcn (padrão CVA/radix-like) + react-hook-form/zod-like + dnd-kit + framer-motion + lucide**. Sem backend real — `src/mocks/backend.ts` simula latência e endpoints.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest: 20 testes unitários da engine/máscaras
npm run build    # valida tsc + vite
npm run lint
```

## O que foi entregue

### 1. Runtime do onboarding (`src/onboarding/`)
- `types.ts` — contrato `OnboardingConfig`: steps → fields, `desktopSpan` (4/6/8/12), `desktopColumns`, `showIf` (condicional), `required/minLength/options`, `headingLevel`.
- `engine.tsx` — `OnboardingProvider` + `useOnboarding`: valores, erros, caminho (`path`), progresso, `next/back/goTo/skip/submit/reset`, validação por etapa (inclui inteiro, 0–100, CPF/CNPJ, monetário), rascunho auto-salvo em `localStorage`, sem “furar” validação no stepper. `skip()` segue a resolução do grafo (nunca pousa em etapa inalcançável).
- `fields.tsx` — `DynamicField` com **21 tipos**. Mobile sempre 1 coluna; desktop usa grid de 12 (`md:col-span-*`). Escolha única (pills/botões) com contrato de radio por teclado (1 stop de Tab, setas/Home/End); `aria-describedby` só referencia nós existentes; `autocomplete` por tipo/id; botão de CEP com `aria-label`.

| Grupo | Tipos |
|---|---|
| Texto e números | text, email, password, tel, number, **integer**, **currency (R$ c/ máscara)**, **percent (0–100)**, **document (CPF/CNPJ auto)**, date, textarea |
| Escolha | **buttons (única, botões grandes)**, radio pills, select, **multiselect (várias, cards)**, chips multi, checkbox, switch |
| Conteúdo | **heading (título/subtítulo)**, **divider**, info |
- `Runtime.tsx` — stepper acessível (`aria-current`, `role=progressbar`, `role=alert`), transição entre etapas, footer Voltar/Pular/Continuar/Enviar, tela de sucesso com protocolo mock, autofill de CEP mock, foco automático por etapa, `data-testid` por campo/botão.

Fluxo padrão (6 etapas): Boas-vindas (“Você é” em botões grandes) → Conta (CPF p/ PF, CNPJ/razão p/ PJ) → Perfil → Endereço (CEP) → Preferências (pulável) → Plano (Enterprise mostra assentos/R$/% + aceite LGPD junto ao Concluir).

### 2. Builder de campos (`src/builder/Builder.tsx`)
- **Paleta** com 21 tipos em 3 grupos (Texto e números / Escolha / Conteúdo) — **arraste para dentro da etapa** (dnd-kit) ou clique em “+ Campo”.
- **Canvas** com etapas (adicionar/duplicar/excluir/reordenar) e campos (reordenar **entre etapas** via drag, editar, excluir). Toggle de preview **Mobile (frame 400px, 1 coluna)** / **Desktop (grid 12)**.
- **Painel Propriedades**: título/descrição/colunas/pulável da etapa; rótulo/placeholder/opções (`valor|Rótulo` por linha, p/ select, rádio, botões, múltipla e chips)/largura desktop/obrigatório/ajuda/**condicional `showIf`** do campo; estilo do título (título/subtítulo).
- **Persistência**: Salvar → `PUT` mock (localStorage) e o Runtime recarrega; Exportar JSON (download), Importar JSON (colar), Restaurar padrão.

### 3. Builder de fluxo em grafo (`src/flow/FlowBuilder.tsx`, aba “Fluxo”)
- Nós = etapas, arestas = transições. Arraste da alça inferior de um nó até o topo de outro para ligar; botão “+ Etapa” cria passo direto no canvas.
- Clique na aresta para definir a regra: **“sempre”** ou **“somente se a resposta for…”** — campo botões/rádio/select/múltipla/chips + **múltiplos valores** (“qualquer um deles ativa”).
- **Prioridade**: com 2+ saídas no mesmo nó, setas ↑↓ definem a ordem de avaliação (1ª condição que bate vence; “sempre” é o else).
- Semântica do runtime: 1º condicionais que batem (na ordem) → 2º aresta “sempre” → 3º próximo passo linear. Sem nenhuma ligação, o fluxo é 100% linear.
- **Pré-visualizar caminho**: acende em verde o trajeto resolvido com as respostas do rascunho atual (preencha na aba Testar e volte).
- **Salvar e testar**: persiste no mock e pula direto para o runtime com o fluxo novo.
- QA do grafo: alerta de **ciclo**, **etapa inalcançável**, **condição duplicada** e **múltiplas saídas “sempre”** (só a 1ª vale). Posições persistidas em `config.positions`.
- Engine navega por **caminho** (`path`): Voltar desfaz o trajeto, stepper só permite revisitar passos já percorridos, submit valida só o visitado, e o runtime exibe o caminho (“Boas-vindas → Conta → …”).
- React Flow carrega via `lazy()` em chunk separado (~60 kB gzip) para não pesar a primeira tela.
- Chrome de demonstração (meta da config, Recarregar preview, caminho do grafo, legenda nodes/edges) aparece só em dev (`SHOW_DEBUG = import.meta.env.DEV`); some no build.

### 4. Mock backend (`src/mocks/backend.ts`)
`fetchOnboardingConfig`, `saveOnboardingConfig`, `resetOnboardingConfig`, `submitOnboarding` (e-mail com “erro” simula 500), `lookupCep`, `checkEmailAvailable`, `loadDraft/persistDraft`. Troca por `fetch` real sem mexer em engine/UI.

## Adaptabilidade mobile/desktop
| | Mobile (<768px) | Desktop (≥768px) |
|---|---|---|
| Layout | 1 etapa/tela, 1 coluna, botões empilhados | mesma etapa, grid 12: `desktopSpan` 6 = lado a lado, 4 = 3 colunas, 12 = linha cheia |
| Stepper | pills compactas (nº) | pills com título |
| Builder | frame de celular 400px | largura total |

## Boas práticas aplicadas (UI/UX + QA)
- Validação inline PT-BR com `aria-invalid` + `role=alert`; foco no primeiro campo/erro; Enter envia.
- LGPD explícita, microcopy de rascunho, estados loading (skeletons), erro com retry, vazio (etapa sem campos), sucesso com protocolo.
- Teclado: paleta e campos operáveis sem mouse (botões + “+ Campo”); drag tem alternativa por clique.
- `data-testid` em pontos-chave (`tab-runtime/tab-builder`, `step-form-*`, `field-*`, `input-*`, `btn-next/back/submit/skip`, `builder-*`, `preview-mobile/desktop`, `success-screen`).
- Para testar erros: e-mail contendo `erro` falha no submit; CEP com 8 dígitos preenche cidade/UF/rua.

## Tema dark/light + responsividade

- Toggle **Claro / Escuro / Sistema** no header (`src/theme/ThemeProvider.tsx`), persistido em `localStorage`, com script inline no `index.html` que aplica a classe antes da primeira pintura (sem FOUC) e `theme-color` por esquema.
- Tailwind v4 em modo `dark` por classe (`@custom-variant`), tokens semânticos em todos os componentes — contraste verificado em screenshots nos 4 combos (`npm run test:themes` → `qa/theme-shots.cjs`).
- Auditoria programática (`npm run test:contrast` → `qa/contrast.cjs`, com conversão `oklch→sRGB`): corpo, `muted`, botão Continuar ≥ 4.5 nos dois temas (light: 19.8 / 4.74 / 17.18; dark: 18.97 / 7.66 / 14.23) + footer grudado no final (`flex-col min-h-svh` + `main flex-1`). Atenção: `muted` no light (4.74) passa no limite do AA — não escurecer sem re-testar.
- Header empilha no mobile (marca + toggle na 1ª linha, abas com scroll horizontal na 2ª); stepper mostra só números no `sm-`; botões Voltar/Continuar empilham full-width; canvas do Fluxo `420px → 560px`; badge “Etapa X de Y” + selo “Opcional” reforçam hierarquia.
- `@media (prefers-reduced-motion: reduce)` global zera animações/transições.

## QA no navegador (Chrome real)

Mesmo setup do POC-Checkout: `opencode.json` registra o `chrome-devtools-mcp` (screenshots, console, snapshots). Smoke E2E versionado em `qa/smoke-chrome.cjs` (playwright-core, usa o Chrome instalado — sem baixar browser):

```bash
npm run dev -- --port 5174   # 5173 costuma estar ocupada pelo POC-Checkout
npm run test:browser         # 12 cenários; ou PORT=5173 npm run test:browser
```

Última execução: **12/12 PASS, 0 erros de console/pageerror**. Cobre: carga padrão (6 etapas), bloqueio sem LGPD, condicional PJ (mostra razão/CNPJ, esconde CPF), fluxo completo até protocolo `POC-######`, máscara R$ (`5000000` → `50.000,00`), CEP mock preenchendo cidade/UF, builder (paleta + preview mobile), fluxo (6 nós) e runtime 390px em 1 coluna. Screenshots em `%TEMP%/opencode/onb-*.png`.

**Testes unitários** (`npm test` → Vitest, 20 testes): `engine.test.ts` cobre visibilidade condicional, validação (inclui **regressão da quebra** dos condicionais obrigatórios), prioridade condicional→sempre→linear do `resolveNextId`, destino fantasma/self-loop e detecção de ciclo; `utils.test.ts` cobre as máscaras BR.

**Abrir no Chrome via MCP**: `node qa/open-mcp-chrome.cjs [url]` — fala com o `chrome-devtools-mcp` por stdio (mesmas 29 tools do `opencode.json`: `new_page`, `take_snapshot`, `take_screenshot`, `wait_for`, `click`, `fill`…), aguarda o conteúdo e salva snapshot + screenshot. Útil quando a sessão não expõe as tools do navegador diretamente.

**Drive via MCP** (`npm run test:mcp` → `qa/mcp-drive.cjs`): simula o usuário só com tools do MCP — clica Continuar sem LGPD e confere o erro inline, marca LGPD + PJ e confere a etapa Conta, checa `list_console_messages` (zero erros) e `list_network_requests` (sem falhas). Última execução: **4/4 PASS**.

## Correções aplicadas (quebra de código)
- `validateField` checava visibilidade com valores vazios (`{}`), o que marcava **todo campo condicional como invisível** e pulava a validação mesmo visível — obrigatórios condicionais (ex.: razão social p/ PJ) nunca eram exigidos. Removido o check interno; a filtragem é feita pelos chamadores com os valores reais.
- Listener do CEP mock re-subscrito a cada render (dep no objeto `ob`); agora depende só de `setValue` memoizado.
- Removido `data-testid` fantasma no `Button`.
- **Flow**: excluir etapa na aba Campos deixava aresta órfã (warning do ReactFlow + contagem inconsistente) — o canvas agora filtra ligações inválidas ao abrir; conexão duplicada mesma origem→destino é bloqueada (seleciona a existente); alerta de ciclo exibe títulos em vez de ids.

## Limitações conhecidas da POC
- CLI `shadcn@latest init` falha no Windows neste template (“Could not load workspace config”) e gerava pasta literal `@/` — por isso os primitivos de UI foram escritos à mão em `src/components/ui/primitives.tsx` seguindo o padrão shadcn/CVA (sem dependência `@base-ui`).
- Persistência é `localStorage`; multi-aba não sincroniza; sem i18n (só PT-BR) e sem testes automatizados (checklist manual em tela).
- Próximos passos: `sonner` p/ toasts, `react-hook-form+zod` por etapa, testes (Vitest + Playwright), temas, versionamento de config no “servidor”.
