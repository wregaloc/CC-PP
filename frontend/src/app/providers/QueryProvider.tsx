import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { normalizeError } from "@/lib/apiError";

export function QueryProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();

  // useState(() => ...) en vez de un valor módulo-nivel: cada instancia de
  // <QueryProvider> (p. ej. una nueva en cada test) obtiene su propio
  // QueryClient — ver [[react-enterprise-frontend]].
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
        // Manejo global de errores de servidor (ver [[react-enterprise-frontend]]):
        // cualquier query/mutation que no maneje su propio error explícitamente
        // (p. ej. con un <Alert> en la vista) termina mostrando un toast — nunca
        // un error silencioso.
        queryCache: new QueryCache({
          onError: (error) => showToast(normalizeError(error).message, "error"),
        }),
        mutationCache: new MutationCache({
          onError: (error) => showToast(normalizeError(error).message, "error"),
        }),
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
