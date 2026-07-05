import { RouterProvider } from "react-router-dom";

import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/features/auth/context/AuthContext";

import { QueryProvider } from "@/app/providers/QueryProvider";
import { router } from "@/app/router";

/**
 * Composición raíz de providers. Orden deliberado (de afuera hacia adentro):
 * ErrorBoundary (red de seguridad de último recurso) → ToastProvider (lo
 * necesita QueryProvider para notificar errores de servidor) → AuthProvider
 * (lo necesitan las rutas protegidas y el layout) → QueryProvider → router.
 */
export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <QueryProvider>
            <RouterProvider router={router} />
          </QueryProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
