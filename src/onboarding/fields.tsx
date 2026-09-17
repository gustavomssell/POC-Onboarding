import { useRef, useState } from "react";
import { cn, formatBRL, formatDocument, onlyDigits } from "@/lib/utils";
import type { FieldConfig, Values } from "@/onboarding/types";
import { isFieldVisible } from "@/onboarding/engine";
import { Input, Label, Separator, Textarea } from "@/components/ui/primitives";
import { lookupCep } from "@/mocks/backend";
import { Check, ChevronRight, Info, Loader2, MapPin } from "lucide-react";

interface Props {
  field: FieldConfig;
  value: Values[string];
  error?: string;
  allValues: Values;
  onChange: (v: Values[string]) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function spanClass(span?: number): string {
  // mobile: sempre full. desktop: fração de 12 (container query — responde ao frame, não à janela).
  switch (span) {
    case 4:
      return "col-span-1 @md:col-span-4";
    case 6:
      return "col-span-1 @md:col-span-6";
    case 8:
      return "col-span-1 @md:col-span-8";
    default:
      return "col-span-1 @md:col-span-12";
  }
}

/**
 * Escolha única com contrato de radio de verdade: um stop de Tab,
 * setas navegam + selecionam, Home/End vão aos extremos.
 */
function SingleChoice({
  field,
  value,
  onChange,
  disabled,
  variant,
}: {
  field: FieldConfig;
  value: Values[string];
  onChange: (v: Values[string]) => void;
  disabled?: boolean;
  variant: "pills" | "cards";
}) {
  const opts = field.options ?? [];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = opts.findIndex((o) => o.value === value);

  const choose = (i: number) => {
    const o = opts[i];
    if (!o || disabled) return;
    onChange(o.value);
    refs.current[i]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    if (e.key === "Home") return choose(0);
    if (e.key === "End") return choose(opts.length - 1);
    const fwd = e.key === "ArrowRight" || e.key === "ArrowDown";
    // navega a partir do botão focado (não do selecionado): com nada
    // selecionado e foco na 1ª opção, → move para a 2ª em vez de ficar parado
    const focused = refs.current.findIndex((el) => el === document.activeElement);
    const base = focused >= 0 ? focused : selected;
    const start = base < 0 ? (fwd ? -1 : 0) : base;
    choose((start + (fwd ? 1 : -1) + opts.length) % opts.length);
  };

  if (variant === "cards") {
    return (
      <div role="radiogroup" aria-label={field.label} onKeyDown={onKeyDown} className="flex flex-col gap-2">
        {opts.map((o, i) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={i === (selected < 0 ? 0 : selected) ? 0 : -1}
              data-testid={`buttons-${field.id}-${o.value}`}
              onClick={() => onChange(o.value)}
              disabled={disabled}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-xl border p-3.5 text-left text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"
              )}
            >
              {o.label}
              {active ? <Check className="size-4 shrink-0" aria-hidden /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label={field.label} onKeyDown={onKeyDown} className="flex flex-wrap gap-2">
      {opts.map((o, i) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={i === (selected < 0 ? 0 : selected) ? 0 : -1}
            data-testid={`radio-${field.id}-${o.value}`}
            onClick={() => onChange(o.value)}
            disabled={disabled}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm transition-all focus-visible:ring-2 focus-visible:ring-ring",
              active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
            )}
          >
            {active && <Check className="size-4" aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function DynamicField({ field, value, error, allValues, onChange, disabled, autoFocus }: Props) {
  const [lookingCep, setLookingCep] = useState(false);
  if (!isFieldVisible(field, allValues)) return null;

  const describedBy = [field.help ? `${field.id}-help` : null, error ? `${field.id}-error` : null]
    .filter(Boolean)
    .join(" ");
  const describedProps = describedBy ? { "aria-describedby": describedBy } : {};
  const invalid = Boolean(error);

  /** autocomplete por tipo/convencao de id (mobile mostra o teclado certo + preenche) */
  const autoComplete = (() => {
    const id = field.id.toLowerCase();
    if (field.type === "email" || id.includes("email")) return "email";
    if (field.type === "tel" || id.includes("phone") || id.includes("cel") || id.includes("whats")) return "tel";
    if (field.type === "password") return "new-password";
    if (id === "name" || id.includes("nome") || id.includes("full")) return "name";
    if (id === "cep" || id.includes("postal") || id.includes("zip")) return "postal-code";
    if (id === "city" || id.includes("cidade")) return "address-level2";
    if (id === "uf" || id.includes("estado") || id.includes("state")) return "address-level1";
    if (id.includes("street") || id.includes("rua") || id.includes("avenida")) return "street-address";
    if (id.includes("birth") || id.includes("nasc")) return "bday";
    if (id.includes("company") || id.includes("empresa") || id.includes("razao")) return "organization";
    return undefined;
  })();

  const wrap = (children: React.ReactNode) => (
    <div data-testid={`field-${field.id}`} className={cn("flex flex-col gap-1.5", spanClass(field.desktopSpan))}>
      {field.type !== "info" && field.type !== "checkbox" && field.type !== "switch" && (
        <Label htmlFor={field.id}>
          {field.label} {field.required && <span aria-hidden className="text-destructive">*</span>}
        </Label>
      )}
      {children}
      {field.help && (
        <p id={`${field.id}-help`} className="text-xs text-muted-foreground">
          {field.help}
        </p>
      )}
      {error && (
        <p id={`${field.id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );

  if (field.type === "info") {
    return (
      <div data-testid={`field-${field.id}`} className={cn("flex gap-2 rounded-lg border bg-muted/60 p-3 text-sm", spanClass(field.desktopSpan))}>
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-medium">{field.label}</p>
          {field.content && <p className="text-muted-foreground">{field.content}</p>}
        </div>
      </div>
    );
  }

  if (field.type === "textarea") {
    return wrap(
      <Textarea
        id={field.id}
        value={(value as string) ?? ""}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        {...describedProps}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    );
  }

  if (field.type === "select") {
    return wrap(
      <select
        id={field.id}
        data-testid={`input-${field.id}`}
        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        disabled={disabled}
        autoFocus={autoFocus}
      >
        <option value="">Selecione…</option>
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "radio") {
    return wrap(
      <SingleChoice field={field} value={value} onChange={onChange} disabled={disabled} variant="pills" />
    );
  }

  if (field.type === "checkbox") {
    return (
      <div data-testid={`field-${field.id}`} className={spanClass(field.desktopSpan)}>
        <label htmlFor={field.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm hover:bg-muted/50">
          <input
            id={field.id}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="mt-0.5 size-4 accent-black dark:accent-white"
          />
          <span>
            {field.label} {field.required && <span aria-hidden className="text-destructive">*</span>}
            {error && (
              <span role="alert" className="block text-xs font-medium text-destructive">
                {error}
              </span>
            )}
          </span>
        </label>
      </div>
    );
  }

  if (field.type === "switch") {
    const on = value === true;
    return (
      <div data-testid={`field-${field.id}`} className={spanClass(field.desktopSpan)}>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          id={field.id}
          onClick={() => onChange(!on)}
          disabled={disabled}
          className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm hover:bg-muted/50"
        >
          <span>{field.label}</span>
          <span
            aria-hidden
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              on ? "bg-primary" : "bg-muted-foreground/30"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
                on && "translate-x-5"
              )}
            />
          </span>
        </button>
      </div>
    );
  }

  if (field.type === "chips") {
    const arr = (Array.isArray(value) ? value : []) as string[];
    return wrap(
      <div className="flex flex-wrap gap-2">
        {field.options?.map((o) => {
          const active = arr.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              data-testid={`chip-${field.id}-${o.value}`}
              disabled={disabled}
              onClick={() => onChange(active ? arr.filter((a) => a !== o.value) : [...arr, o.value])}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-all focus-visible:ring-2",
                active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  // heading — título / subtítulo de seção (display, sem valor)
  if (field.type === "heading") {
    const lvl = field.headingLevel ?? "title";
    return (
      <div data-testid={`field-${field.id}`} className={spanClass(field.desktopSpan)}>
        {lvl === "subtitle" ? (
          <p className="text-sm text-muted-foreground">{field.label}</p>
        ) : (
          <h3 className="text-lg font-semibold tracking-tight">{field.label}</h3>
        )}
        {field.content && <p className="mt-0.5 text-sm text-muted-foreground">{field.content}</p>}
      </div>
    );
  }

  // divider — linha separadora opcional com legenda
  if (field.type === "divider") {
    return (
      <div data-testid={`field-${field.id}`} className={cn("flex items-center gap-3", spanClass(field.desktopSpan))} aria-hidden={!field.label}>
        <Separator className="flex-1" />
        {field.label && <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">{field.label}</span>}
        {field.label && <Separator className="flex-1" />}
      </div>
    );
  }

  // buttons — escolha única em botões grandes (padrão mobile de onboarding)
  if (field.type === "buttons") {
    return wrap(
      <SingleChoice field={field} value={value} onChange={onChange} disabled={disabled} variant="cards" />
    );
  }

  // multiselect — múltipla escolha em cards com checkbox
  if (field.type === "multiselect") {
    const arr = (Array.isArray(value) ? value : []) as string[];
    return wrap(
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {field.options?.map((o) => {
          const active = arr.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              data-testid={`multi-${field.id}-${o.value}`}
              disabled={disabled}
              onClick={() => onChange(active ? arr.filter((a) => a !== o.value) : [...arr, o.value])}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm transition-all focus-visible:ring-2",
                active ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-md border",
                  active && "border-primary bg-primary text-primary-foreground"
                )}
              >
                {active && <Check className="size-3.5" />}
              </span>
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  // currency — R$ com máscara BR (armazena "1.234,56")
  if (field.type === "currency") {
    return wrap(
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
          R$
        </span>
        <Input
          id={field.id}
          data-testid={`input-${field.id}`}
          className="pl-9"
          inputMode="numeric"
          value={(value as string) ?? ""}
          placeholder={field.placeholder ?? "0,00"}
          onChange={(e) => onChange(formatBRL(e.target.value))}
          aria-invalid={invalid}
          {...describedProps}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      </div>
    );
  }

  // percent — 0 a 100 com sufixo %
  if (field.type === "percent") {
    return wrap(
      <div className="relative">
        <Input
          id={field.id}
          data-testid={`input-${field.id}`}
          className="pr-9"
          inputMode="decimal"
          value={(value as string) ?? ""}
          placeholder={field.placeholder ?? "0"}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))}
          aria-invalid={invalid}
          {...describedProps}
          disabled={disabled}
          autoFocus={autoFocus}
        />
        <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
          %
        </span>
      </div>
    );
  }

  // integer — só inteiros
  if (field.type === "integer") {
    return wrap(
      <Input
        id={field.id}
        data-testid={`input-${field.id}`}
        inputMode="numeric"
        value={(value as string) ?? ""}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9-]/g, ""))}
        aria-invalid={invalid}
        {...describedProps}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    );
  }

  // document — CPF/CNPJ com máscara automática
  if (field.type === "document") {
    const digits = onlyDigits(String(value ?? ""));
    return wrap(
      <div className="flex flex-col gap-1.5">
        <Input
          id={field.id}
          data-testid={`input-${field.id}`}
          inputMode="numeric"
          value={(value as string) ?? ""}
          placeholder={field.placeholder ?? "CPF ou CNPJ"}
          onChange={(e) => onChange(formatDocument(e.target.value))}
          aria-invalid={invalid}
          {...describedProps}
          disabled={disabled}
          autoFocus={autoFocus}
        />
        {digits.length > 0 && digits.length <= 11 && (
          <span className="text-xs text-muted-foreground">Detectado: CPF</span>
        )}
        {digits.length > 11 && <span className="text-xs text-muted-foreground">Detectado: CNPJ</span>}
      </div>
    );
  }

  // text | email | password | tel | number | date (+ CEP com lookup)
  return wrap(
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input
          id={field.id}
          data-testid={`input-${field.id}`}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type}
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          {...describedProps}
          autoComplete={autoComplete}
          disabled={disabled}
          autoFocus={autoFocus}
          inputMode={field.type === "tel" ? "tel" : field.type === "number" ? "numeric" : undefined}
        />
        {field.id === "cep" && (
          <button
            type="button"
            aria-label="Buscar endereço pelo CEP"
            disabled={lookingCep || disabled}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border hover:bg-muted disabled:opacity-50"
            onClick={async () => {
              setLookingCep(true);
              const r = await lookupCep(String(allValues.cep ?? ""));
              setLookingCep(false);
              if (r) {
                // preenche via evento customizado ouvido pelo Runtime
                window.dispatchEvent(new CustomEvent("poc:cep", { detail: r }));
              }
            }}
          >
            {lookingCep ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
