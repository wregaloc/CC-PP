import { Skeleton } from "@/components/ui/Skeleton";
import { QueryState } from "@/components/ui/QueryState";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { KpiCard } from "@/features/dashboard/components/KpiCard";
import { formatCompactNumber, formatPercent } from "@/features/dashboard/lib/formatters";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useKpis } from "@/features/dashboard/hooks/useKpis";

/** Fila de KPIs principales — Doc-Migración §5.1 "Sección Superior — KPI
 * Cards": Vistas Totales, Engagement Rate, Likes, Comentarios, Emisiones,
 * Pico Max en Vivo y Promedio en Vivo (antes solo visibles en "Detalle de
 * Canal" de la Página 2, Doc-Migración §5.2). Las 7 tarjetas vienen del
 * mismo endpoint /dashboard/kpis y respetan los mismos filtros (programa +
 * canal + fechas) — Pico Max/Promedio ya no dependen exclusivamente de
 * elegir un canal. */
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        }
      >
        {query.data && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
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
            <KpiCard
              label="Pico Max en Vivo"
              value={
                query.data.pico_max_vivo !== null
                  ? formatCompactNumber(query.data.pico_max_vivo)
                  : "—"
              }
              description="MAX(DATA[Pico Max])"
            />
            <KpiCard
              label="Promedio en Vivo"
              value={
                query.data.promedio_vivo !== null
                  ? formatCompactNumber(query.data.promedio_vivo)
                  : "—"
              }
              description="AVG(DATA[Promedio en Vivo])"
            />
          </div>
        )}
      </QueryState>
    </DashboardCard>
  );
}
