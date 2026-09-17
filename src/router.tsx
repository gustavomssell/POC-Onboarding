import { createBrowserRouter, Link, Navigate } from "react-router-dom";
import { lazy } from "react";
import App from "./App";

const OnboardingListPage = lazy(() => import("./pages/OnboardingListPage"));
const OnboardingEditorPage = lazy(() => import("./pages/OnboardingEditorPage"));

function NotFoundPage() {
  return (
    <section className="flex flex-col items-start gap-4 py-12">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-muted-foreground">Confira o endereço ou escolha um onboarding na lista.</p>
      <Link to="/onboardings" className="underline underline-offset-4">Voltar aos onboardings</Link>
    </section>
  );
}

export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/onboardings" replace /> },
      { path: "onboardings", element: <OnboardingListPage /> },
      { path: "onboardings/:id", element: <Navigate to="campos" replace /> },
      { path: "onboardings/:id/:mode", element: <OnboardingEditorPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
