import { Navigate, Outlet, useLocation } from "react-router-dom";

import { FullPageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/features/auth/context/AuthContext";
import type { UserRole } from "@/types/roles";

interface ProtectedRouteProps {
  /** Si se omite, solo exige estar autenticado (cualquier rol) — ver TDD
   * §5.1: por defecto todos los roles ven la misma información. */
  allowedRoles?: UserRole[];
}

/**
 * Guarda de rutas del lado del cliente — es UX, no seguridad real: el backend
 * es quien siempre verifica rol y autenticación (ver [[enterprise-security]]).
 * Esto solo evita que la UI muestre una pantalla a la que el usuario no
 * debería ni intentar entrar, y redirige de vuelta con el intento fallido.
 */
export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
