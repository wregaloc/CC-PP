import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Red de seguridad para errores de renderizado que ninguna vista maneja
 * explícitamente (ver [[react-enterprise-frontend]] — manejo global de
 * errores). Los errores de llamadas a la API no pasan por aquí — esos los
 * maneja TanStack Query / el interceptor de axios; esto es solo para errores
 * de JavaScript durante el render (debe ser un componente de clase, React no
 * tiene un hook equivalente a componentDidCatch).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Error no controlado en el árbol de componentes:", error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.assign("/");
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white p-6 text-center dark:bg-neutral-950">
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Ocurrió un error inesperado
          </h1>
          <p className="max-w-md text-sm text-neutral-600 dark:text-neutral-400">
            La aplicación encontró un problema y no puede continuar en esta pantalla. Intenta
            recargar la página.
          </p>
          <Button onClick={this.handleReload}>Recargar</Button>
        </div>
      );
    }

    return this.props.children;
  }
}
