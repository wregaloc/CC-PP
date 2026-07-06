import { Skeleton } from "@/components/ui/Skeleton";
import { QueryState } from "@/components/ui/QueryState";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { KpiCard } from "@/features/dashboard/components/KpiCard";
import { formatCompactNumber, formatPercent } from "@/features/dashboard/lib/formatters";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useKpis } from "@/features/dashboard/hooks/useKpis";

/** Fila de KPIs principales — Doc-Migración §5.1 "Sección Superior — KPI
 * Cards": Vistas Totales, Engagement Rate, Likes, Comentarios, Emisiones. */
export function KpiRow() {
  const { filters } = useDashboardFilters();
  const query = useKpis(filters);

  return (
    <DashboardCard title="KPIs principales">
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={query.refetch}
        loadingFallback={
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        }
      >
        {query.data && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              label="Vistas Totales"
              value={formatCompactNumber(query.data.vistas_totales)}
              description="DATA[Vistas Totales]"
            />
            <KpiCard
              label="Engagement Rate"
              value={formatPercent(query.data.engagement_rate)}
              description="Promedio de DATA[Engagement] — calidad de audiencia, no solo volumen"
            />
            <KpiCard
              label="Likes"
              value={formatCompactNumber(query.data.likes)}
              description="SUM(DATA[Likes])"
            />
            <KpiCard
              label="Comentarios"
              value={formatCompactNumber(query.data.comentarios)}
              description="SUM(DATA[Comentarios])"
            />
            <KpiCard
              label="Emisiones"
              value={formatCompactNumber(query.data.emisiones)}
              description="SUM(DATA[Es_Emision]) — conteo de emisiones, no un flag sí/no"
            />
          </div>
        )}
      </QueryState>
    </DashboardCard>
  );
}
