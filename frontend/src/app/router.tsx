import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { LoginPage } from "@/features/auth/pages/LoginPage";

import { NotFoundPage } from "@/app/NotFoundPage";
import { ProtectedRoute } from "@/app/ProtectedRoute";

// Carga perezosa: el dashboard trae Recharts (~700 kB) y el panel de admin es
// una superficie grande que solo ve el rol Admin — no tiene sentido bloquear
// /login con ese peso (ver [[react-enterprise-frontend]] — lazy/Suspense en
// rutas pesadas).
const DashboardPage = lazy(() =>
  import("@/features/dashboard/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const AdminLayout = lazy(() =>
  import("@/features/admin/components/AdminLayout").then((m) => ({ default: m.AdminLayout })),
);
const AdminDashboardPage = lazy(() =>
  import("@/features/admin/pages/AdminDashboardPage").then((m) => ({
    default: m.AdminDashboardPage,
  })),
);
const AdminTeamPage = lazy(() =>
  import("@/features/admin/pages/AdminTeamPage").then((m) => ({ default: m.AdminTeamPage })),
);
const AdminClientsPage = lazy(() =>
  import("@/features/admin/pages/AdminClientsPage").then((m) => ({ default: m.AdminClientsPage })),
);
const AdminClientDetailPage = lazy(() =>
  import("@/features/admin/pages/AdminClientDetailPage").then((m) => ({
    default: m.AdminClientDetailPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import("@/features/admin/pages/AdminUsersPage").then((m) => ({ default: m.AdminUsersPage })),
);
const AdminUploadsPage = lazy(() =>
  import("@/features/admin/pages/AdminUploadsPage").then((m) => ({ default: m.AdminUploadsPage })),
);

/**
 * Árbol de rutas de la app. `/` es la Página 1 del dashboard (Fase 8, ver
 * Doc-Migración §5.1). `/admin/*` es el Panel de Administración (Fase 10) —
 * exclusivo del rol Admin, con sus 5 módulos anidados bajo `<AdminLayout/>`.
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
            children: [
              {
                path: "/admin",
                element: (
                  <Suspense fallback={<FullPageSpinner />}>
                    <AdminLayout />
                  </Suspense>
                ),
                children: [
                  { index: true, element: <Navigate to="/admin/dashboard" replace /> },
                  { path: "dashboard", element: <AdminDashboardPage /> },
                  { path: "equipo", element: <AdminTeamPage /> },
                  { path: "clientes", element: <AdminClientsPage /> },
                  { path: "clientes/:clientId", element: <AdminClientDetailPage /> },
                  { path: "usuarios", element: <AdminUsersPage /> },
                  { path: "uploads", element: <AdminUploadsPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
