import type { ReactNode } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { normalizeError } from "@/lib/apiError";

interface QueryStateProps {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  loadingFallback: ReactNode;
  children: ReactNode;
}

/**
 * Envoltorio común de loading/error/empty para cualquier widget que consuma
 * TanStack Query (ver [[react-enterprise-frontend]] — obligatorio contemplar
 * los 3 estados). El toast global (ver QueryProvider) ya notifica el error;
 * esto además dejo un estado inline con reintento, para no perder el widget
 * entero por un fallo transitorio de red.
 */
export function QueryState({
  isLoading,
  isError,
  error,
  isEmpty = false,
  emptyMessage = "No hay datos para el filtro seleccionado.",
  onRetry,
  loadingFallback,
  children,
}: QueryStateProps) {
  if (isLoading) {
    return <>{loadingFallback}</>;
  }

  if (isError) {
    const message = error ? normalizeError(error).message : "Ocurrió un error al cargar los datos.";
    return (
      <Alert variant="error">
        <div className="flex flex-col items-start gap-2">
          <span>{message}</span>
          {onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              Reintentar
            </Button>
          )}
        </div>
      </Alert>
    );
  }

  if (isEmpty) {
    return <Alert variant="info">{emptyMessage}</Alert>;
  }

  return <>{children}</>;
}
