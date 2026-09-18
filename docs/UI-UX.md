# UI/UX — Design System

## Tokens (src/index.css)

### Tema

```css
/* Light (default) */
--background: oklch(1 0 0)        /* branco puro */
--foreground: oklch(0.145 0 0)    /* quase preto */
--primary: oklch(0.205 0 0)       /* preto suave */
--muted: oklch(0.97 0 0)          /* cinza claro */
--muted-foreground: oklch(0.556 0 0) /* cinza médio */
--destructive: oklch(0.577 0.245 27.325) /* vermelho */

/* Dark */
--background: oklch(0.145 0 0)    /* quase preto */
--foreground: oklch(0.985 0 0)    /* branco */
--primary: oklch(0.922 0 0)       /* branco suave */
--card: oklch(0.205 0 0)          /* cinza escuro */
```

### Tokens Semânticos

| Token | Uso |
|---|---|
| `background` | Fundo da página |
| `foreground` | Texto principal |
| `card` / `card-foreground` | Fundo e texto de cards |
| `primary` / `primary-foreground` | Botões principais, links |
| `secondary` / `secondary-foreground` | Botões secundários |
| `muted` / `muted-foreground` | Texto auxiliar, placeholders |
| `accent` / `accent-foreground` | Hover states |
| `destructive` | Erros, exclusão |
| `border` / `input` / `ring` | Bordas, inputs, focus rings |

### Border Radius

```css
--radius: 0.625rem;     /* 10px — base */
--radius-lg: var(--radius);
--radius-md: calc(var(--radius) - 2px);  /* 8px */
--radius-sm: calc(var(--radius) - 4px);  /* 6px */
```

## Componentes (src/components/ui/primitives.tsx)

### Button

```tsx
<Button variant="default" size="sm">
  {/* variant: default | outline | secondary | ghost | destructive */}
  {/* size: default | sm | lg | icon */}
</Button>
```

| Prop | Valores | Padrão |
|---|---|---|
| variant | default, outline, secondary, ghost, destructive | default |
| size | default (h-9), sm (h-8), lg (h-11), icon (size-9) | default |

### Card

```tsx
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descrição</CardDescription>
  </CardHeader>
  <CardContent>Conteúdo</CardContent>
  <CardFooter>Rodapé</CardFooter>
</Card>
```

### Input

```tsx
<Input placeholder="..." aria-invalid={hasError} />
```

### Badge

```tsx
<Badge className="...">...</Badge>
```

### Alert

```tsx
<Alert tone="error">...</Alert>
{/* tone: error | info | success */}
```

## Layout

### Responsividade

```css
/* Mobile: 1 coluna sempre */
/* Desktop: grid 12 colunas via container queries */
@container (min-width: 768px) {
  .spanClass { /* usa @md:col-span-* */ }
}
```

### Grid do Builder

```
Desktop: lg:grid-cols-[220px_1fr_280px]
  ├── Paleta (220px)
  ├── Canvas (1fr)
  └── Propriedades (280px, lg:sticky)

Mobile: grid-cols-1
  ├── Paleta (colapsável)
  ├── Canvas
  └── Propriedades (abaixo)
```

### Frame Mobile (Builder)

```
┌─────────────────────┐
│  ┌───────────────┐  │  ← rounded-[2rem] border-4
│  │    notch      │  │  ← h-1 w-16 rounded-full
│  │               │  │
│  │   Canvas      │  │  ← scroll interno
│  │   (390px)     │  │
│  │               │  │
│  └───────────────┘  │
└─────────────────────┘
```

## Interações

### Drag and Drop (dnd-kit)

- **Paleta → Canvas**: arrastar tipo cria campo na etapa
- **Canvas**: reordenar campos entre etapas
- **Alternativa**: clique em "+ Campo" (acessibilidade)

### Transições (framer-motion)

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={currentId}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2 }}
  >
    {/* conteúdo da etapa */}
  </motion.div>
</AnimatePresence>
```

### Toggle Device

```
Mobile: frame 400px, 1 coluna, stepper oculto
Desktop: largura total, grid 12, stepper visível
```

## Acessibilidade

### Contraste

- WCAG AA: ≥4.5 para texto normal
- WCAG AA: ≥3 para texto grande (18px+ bold)
- Verificação automatizada: `npm run test:contrast`

### Navegação por Teclado

- **Tab**: navega entre campos
- **Enter**: envia formulário ou ativa botão
- **Escape**: fecha modais
- **Setas**: navega em radios/botões (roving tabindex)
- **Home/End**: primeiro/último item

### ARIA

| Elemento | Atributos |
|---|---|
| Stepper | `aria-current="step"`, `role="progressbar"` |
| Erros | `role="alert"`, `aria-invalid="true"` |
| Botões radio | `aria-checked`, `role="radio"` |
| Modais | `role="dialog"`, `aria-modal="true"` |
| Campos | `aria-describedby` (help text) |

### Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Paleta de Cores por Contexto

| Contexto | Light | Dark |
|---|---|---|
| Fundo | branco | quase preto |
| Card | branco | cinza escuro |
| Texto principal | quase preto | branco |
| Texto auxiliar | cinza médio | cinza claro |
| Erro | vermelho | vermelho |
| Borda | cinza claro | cinza escuro |
| Focus ring | cinza | cinza |

## Ícones

Usados via `lucide-react`:

| Ícone | Uso |
|---|---|
| `MonitorSmartphone` | Logo header |
| `Eye` | Propriedades |
| `GripVertical` | Drag handle |
| `Pencil` | Editar campo |
| `Trash2` | Remover campo |
| `Plus` | Adicionar etapa/campo |
| `Save` | Salvar |
| `RotateCcw` | Restaurar padrão |
| `Download` | Exportar JSON |
| `Upload` | Importar JSON |
| `Smartphone` | Toggle mobile |
| `Monitor` | Toggle desktop |
| `ChevronLeft/Right` | Navegação |
| `Check` | Sucesso |
| `AlertTriangle` | Aviso |
| `X` | Fechar |
