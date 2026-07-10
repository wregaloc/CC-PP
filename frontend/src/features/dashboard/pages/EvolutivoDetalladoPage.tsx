import { CanalDetailPanel } from "@/features/dashboard/components/CanalDetailPanel";
import { EvolutivoDetalladoChart } from "@/features/dashboard/components/EvolutivoDetalladoChart";
import { FilterBar } from "@/features/dashboard/components/FilterBar";
import { RankingCanalesPanel } from "@/features/dashboard/components/RankingCanalesPanel";
import { DashboardFiltersProvider } from "@/features/dashboard/context/DashboardFiltersContext";

/**
 * Página 2 — Evolutivo Detallado (Doc-Migración §5.2).
 *
 * Misma arquitectura de filtros que la Página 1: cada página monta su propia
 * instancia de `DashboardFiltersProvider` (no hay persistencia de filtros
 * entre rutas hoy en día — tampoco la hay al recargar la Página 1, así que
 * esto no es una regresión de comportamiento, es el mismo mecanismo).
 *
 * Diferencia deliberada frente al original: igual que la Página 1 no fuerza
 * fondo negro fijo, esta página tampoco fuerza el fondo claro fijo del
 * Power BI original — sigue `prefers-color-scheme` como el resto de la app,
 * mismo argumento arquitectónico ya documentado en DashboardPage.tsx.
 */
export function EvolutivoDetalladoPage() {
  return (
    <DashboardFiltersProvider>
      <div className="flex flex-col gap-4">
        <FilterBar />
        <EvolutivoDetalladoChart />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <RankingCanalesPanel />
          <CanalDetailPanel />
        </div>
      </div>
    </DashboardFiltersProvider>
  );
}
