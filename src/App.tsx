import { Suspense } from "react";
import { Link, Outlet } from "react-router-dom";
import { MonitorSmartphone } from "lucide-react";
import { Skeleton } from "./components/ui/primitives";
import { ModeToggle } from "./theme/ThemeProvider";

export default function App() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/onboardings" className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:ring-2 focus-visible:ring-ring">
            <MonitorSmartphone className="size-5 shrink-0" aria-hidden />
            <span className="text-sm font-semibold">Onboarding Studio</span>
          </Link>
          <ModeToggle />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}><Outlet /></Suspense>
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-4 text-xs text-muted-foreground">
          <span>Onboarding modular · mobile/desktop</span>
          <span>POC · Dados armazenados neste navegador</span>
        </div>
      </footer>
    </div>
  );
}
