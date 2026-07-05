import { useAuth } from "@/features/auth/context/AuthContext";

/**
 * Landing autenticada — deliberadamente sin KPIs/gráficos/rankings todavía
 * (Fase 7 del TDD: solo infraestructura del frontend). Confirma que el login,
 * la sesión y el layout funcionan de punta a punta antes de construir el
 * dashboard real sobre esta base.
 */
export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Bienvenido a PodPulse
      </h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Sesión iniciada como <span className="font-medium">{user?.role}</span>. El dashboard
        (KPIs, evolutivo, rankings, sentimiento, auspicios) se construye en la siguiente fase sobre
        esta infraestructura.
      </p>
    </div>
  );
}
