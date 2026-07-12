import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { AdminPlaceholderPage } from "@/features/admin/pages/AdminPlaceholderPage";
import { LoginPage } from "@/features/auth/pages/LoginPage";

import { NotFoundPage } from "@/app/NotFoundPage";
import { ProtectedRoute } from "@/app/ProtectedRoute";

// Carga perezosa: el dashboard trae Recharts (~700 kB) — no tiene sentido
// bloquear /login o /admin con ese peso (ver [[react-enterprise-frontend]]
// — lazy/Suspense en rutas pesadas).
const DashboardPage = lazy(() =>
  import("@/features/dashboard/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);

/**
 * Árbol de rutas de la app. `/` es la Página 1 del dashboard (Fase 8, ver
 * Doc-Migración §5.1) — AdminPlaceholderPage sigue pendiente de una fase futura.
 */
export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: "/",
            element: (
              <Suspense fallback={<FullPageSpinner />}>
                <DashboardPage />
              </Suspense>
            ),
          },
          {
            element: <ProtectedRoute allowedRoles={["admin"]} />,
            children: [{ path: "/admin", element: <AdminPlaceholderPage /> }],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
