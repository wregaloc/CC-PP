import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { useAuspicios } from "@/features/dashboard/hooks/useAuspicios";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";

/** Panel AUSPICIOS — Doc-Migración §5.1: lista simple de marcas
 * auspiciadoras filtradas por el programa en contexto. */
export function AuspiciosPanel() {
  const { filters } = useDashboardFilters();
  const query = useAuspicios({ programa: filters.programa });

  return (
    <DashboardCard title="Auspicios">
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isEmpty={query.data?.length === 0}
        emptyMessage="No hay auspiciadores para este filtro."
        onRetry={query.refetch}
        loadingFallback={
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-3/4" />
            ))}
          </div>
        }
      >
        <ul className="flex flex-col gap-2">
          {query.data?.map((auspicio) => (
            <li
              key={auspicio.auspiciador}
              className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-800
                dark:bg-neutral-800 dark:text-neutral-200"
            >
              {auspicio.auspiciador}
            </li>
          ))}
        </ul>
      </QueryState>
    </DashboardCard>
  );
}
