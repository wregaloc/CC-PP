import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { CanalProgramasTable } from "@/features/dashboard/components/CanalProgramasTable";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { KpiCard } from "@/features/dashboard/components/KpiCard";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useCanalLiveStats } from "@/features/dashboard/hooks/useCanalLiveStats";
import { useCanalProgramas } from "@/features/dashboard/hooks/useCanalProgramas";
import { useFilterCategorias } from "@/features/dashboard/hooks/useFilterOptions";
import { formatCompactNumber } from "@/features/dashboard/lib/formatters";

/** Panel Derecho — Detalle de Canal Seleccionado (Doc-Migración §5.2):
 * Pico Max en Vivo + Promedio en Vivo (medidas DATA[Pico Max]/DATA[Promedio
 * en Vivo]), selector de Categoría y ranking "Programas del Canal". Se
 * activa recién cuando `filters.canal` tiene un valor (fijado al hacer clic
 * en Ranking de Canales) — mismo patrón que AuspiciosPanel en la Página 1
 * pidiendo elegir un programa antes de consultar. */
export function CanalDetailPanel() {
  const { filters } = useDashboardFilters();
  const hasCanal = Boolean(filters.canal);
  const [categoria, setCategoria] = useState("");

  const dateFilters = { fecha_inicio: filters.fecha_inicio, fecha_fin: filters.fecha_fin };
  const liveStatsQuery = useCanalLiveStats(filters.canal, dateFilters);
  const programasQuery = useCanalProgramas(filters.canal, {
    ...dateFilters,
    categoria: categoria || undefined,
  });
  const categoriasQuery = useFilterCategorias();

  return (
    <DashboardCard title={filters.canal ? `Detalle: ${filters.canal}` : "Detalle de Canal"}>
      {!hasCanal ? (
        <Alert variant="info">Elige un canal en el ranking para ver su detalle.</Alert>
      ) : (
        <div className="flex flex-col gap-4">
          <QueryState
            isLoading={liveStatsQuery.isLoading}
            isError={liveStatsQuery.isError}
            error={liveStatsQuery.error}
            onRetry={liveStatsQuery.refetch}
            loadingFallback={
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            }
          >
            {liveStatsQuery.data && (
              <div className="grid grid-cols-2 gap-3">
                <KpiCard
                  label="Pico Max en Vivo"
                  value={
                    liveStatsQuery.data.pico_max_vivo !== null
                      ? formatCompactNumber(liveStatsQuery.data.pico_max_vivo)
                      : "—"
                  }
                  description="MAX(DATA[Pico Max])"
                />
                <KpiCard
                  label="Promedio en Vivo"
                  value={
                    liveStatsQuery.data.promedio_vivo !== null
                      ? formatCompactNumber(liveStatsQuery.data.promedio_vivo)
                      : "—"
                  }
                  description="AVG(DATA[Promedio en Vivo])"
                />
              </div>
            )}
          </QueryState>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="filtro-categoria-canal"
              className="text-xs font-medium text-neutral-600 dark:text-neutral-400"
            >
              Categoría
            </label>
            <select
              id="filtro-categoria-canal"
              value={categoria}
              onChange={(event) => setCategoria(event.target.value)}
              className="min-w-[10rem] rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900
                dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              <option value="">Todas</option>
              {categoriasQuery.data?.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <QueryState
            isLoading={programasQuery.isLoading}
            isError={programasQuery.isError}
            error={programasQuery.error}
            isEmpty={programasQuery.data?.length === 0}
            emptyMessage="Este canal no tiene programas para este filtro."
            onRetry={programasQuery.refetch}
            loadingFallback={<Skeleton className="h-40 w-full" />}
          >
            {programasQuery.data && <CanalProgramasTable items={programasQuery.data} />}
          </QueryState>
        </div>
      )}
    </DashboardCard>
  );
}
