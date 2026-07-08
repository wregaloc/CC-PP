import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { KpiCard } from "@/features/dashboard/components/KpiCard";
import { formatPercent } from "@/features/dashboard/lib/formatters";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useSentimentKpis } from "@/features/dashboard/hooks/useSentimentKpis";

/** KPI Cards de Sentimiento — Doc-Migración §5.1: Sentimiento
 * Positivo/Negativo/Neutral, medidas SPLIT SENSE[Sentimiento *]. */
export function SentimentKpiCards() {
  const { filters } = useDashboardFilters();
  const query = useSentimentKpis({
    fecha_inicio: filters.fecha_inicio,
    fecha_fin: filters.fecha_fin,
    programa: filters.programa,
  });

  return (
    <DashboardCard title="Sentimiento de Audiencia">
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={query.refetch}
        loadingFallback={
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        }
      >
        {query.data && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard
              label="Positivo"
              value={formatPercent(query.data.pct_positivo)}
              description="SPLIT SENSE[Sentimiento Positivo]"
              accent="positivo"
            />
            <KpiCard
              label="Negativo"
              value={formatPercent(query.data.pct_negativo)}
              description="SPLIT SENSE[Sentimiento Negativo]"
              accent="negativo"
            />
            <KpiCard
              label="Neutral"
              value={formatPercent(query.data.pct_neutral)}
              description="SPLIT SENSE[Sentimiento Neutral]"
              accent="neutral"
            />
          </div>
        )}
      </QueryState>
    </DashboardCard>
  );
}
