import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";
const LS = "poc-theme";

function systemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && systemDark());
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

const Ctx = createContext<{ theme: Theme; resolved: "light" | "dark"; setTheme: (t: Theme) => void }>({
  theme: "system",
  resolved: "light",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(LS) as Theme) || "system";
    } catch {
      return "system";
    }
  });
  const [sysDark, setSysDark] = useState(systemDark);

  useEffect(() => {
    apply(theme);
    try {
      localStorage.setItem(LS, theme);
    } catch {
      /* privado */
    }
  }, [theme, sysDark]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const resolved = theme === "system" ? (sysDark ? "dark" : "light") : theme;
  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}

const OPTIONS: { id: Theme; label: string; Icon: typeof Sun }[] = [
  { id: "light", label: "Claro", Icon: Sun },
  { id: "dark", label: "Escuro", Icon: Moon },
  { id: "system", label: "Sistema", Icon: Monitor },
];

/** Seletor Claro / Escuro / Sistema (menu acessível). */
export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const Current = OPTIONS.find((o) => o.id === theme)!.Icon;

  const close = () => {
    setOpen(false);
    btnRef.current?.focus();
  };

  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(e) => { if (e.key === "Escape") close(); }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Tema atual: ${OPTIONS.find((o) => o.id === theme)!.label}. Trocar tema.`}
        data-testid="theme-toggle"
        className="inline-flex size-9 items-center justify-center rounded-lg border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Current className="size-4" aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="Escolha o tema" className="absolute right-0 z-20 mt-1.5 w-36 overflow-hidden rounded-lg border bg-popover shadow-lg">
          {OPTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={theme === id}
              data-testid={`theme-${id}`}
              onClick={() => { setTheme(id); setOpen(false); }}
              onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                theme === id && "font-medium"
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
              {theme === id && <Check className="ml-auto size-4" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
