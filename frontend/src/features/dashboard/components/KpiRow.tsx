import { Skeleton } from "@/components/ui/Skeleton";
import { QueryState } from "@/components/ui/QueryState";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { KpiCard } from "@/features/dashboard/components/KpiCard";
import { formatCompactNumber, formatPercent } from "@/features/dashboard/lib/formatters";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useKpis } from "@/features/dashboard/hooks/useKpis";
import type { KpisResponse } from "@/features/dashboard/types";

/** Fila de KPIs principales — Doc-Migración §5.1 "Sección Superior — KPI
 * Cards": Vistas Totales, Engagement Rate, Likes, Comentarios, Emisiones,
 * Pico Max en Vivo, Promedio en Vivo y Promedio de Vistas (antes solo
 * visibles en "Detalle de Canal" de la Página 2, Doc-Migración §5.2). Las 8
 * tarjetas vienen del mismo endpoint /dashboard/kpis y respetan los mismos
 * filtros (programa + canal + fechas) — Pico Max/Promedio ya no dependen
 * exclusivamente de elegir un canal.
 *
 * "Promedio de Vistas" cambia de fórmula según qué tan acotado esté el
 * filtro: con un programa puntual, vistas÷emisiones ("por emisión") tiene
 * sentido porque hay una sola serie de emisiones; con un canal o "Todos"
 * (varios programas mezclados), emisiones de programas distintos no son
 * comparables entre sí, así que se usa vistas÷cantidad de programas
 * distintos ("por programa") — ver `programas_distintos` en KpisResponse. */
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        }
      >
        {query.data && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
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
            <PromedioVistasCard filtroPrograma={filters.programa} data={query.data} />
          </div>
        )}
      </QueryState>
    </DashboardCard>
  );
}

/** KPI "Promedio de Vistas" — la fórmula depende de qué tan acotado esté el
 * filtro activo (ver comentario de KpiRow): con un programa puntual usa
 * vistas÷emisiones; con canal o "Todos" usa vistas÷programas_distintos.
 * Ambos casos degradan a "—" si el divisor es 0 (sin datos), en vez de
 * mostrar Infinity o NaN. */
function PromedioVistasCard({
  filtroPrograma,
  data,
}: {
  filtroPrograma: string | undefined;
  data: KpisResponse;
}) {
  const porPrograma = !filtroPrograma;
  const divisor = porPrograma ? data.programas_distintos : data.emisiones;
  const promedio = divisor > 0 ? data.vistas_totales / divisor : null;

  return (
    <KpiCard
      label="Promedio de Vistas"
      value={promedio !== null ? formatCompactNumber(Math.round(promedio)) : "—"}
      description={
        porPrograma
          ? "Vistas Totales ÷ cantidad de programas distintos en el filtro actual"
          : "Vistas Totales ÷ Emisiones del programa filtrado"
      }
      helperText={porPrograma ? "por programa" : "por emisión"}
    />
  );
}
