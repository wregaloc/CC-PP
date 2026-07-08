import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { formatCompactNumber } from "@/features/dashboard/lib/formatters";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useEvolutivo } from "@/features/dashboard/hooks/useEvolutivo";

/** Gráfico de línea "EVOLUTIVO VISTAS [AÑO]" — Doc-Migración §5.1: evolución
 * de Vistas Totales por mes, título dinámico según el año de los datos. */
export function EvolutivoChart() {
  const { filters } = useDashboardFilters();
  const query = useEvolutivo({ ...filters, granularidad: "mes", metrica_secundaria: "emisiones" });

  // El año en el título solo tiene sentido si TODOS los puntos son del mismo
  // año — con datos mixtos 2025+2026 (p. ej. sin fechas seleccionadas) se
  // usaba el año del primer punto nada más, mostrando "2025" aunque hubiera
  // meses de 2026 en el mismo gráfico.
  const aniosEnRango = new Set(query.data?.map((punto) => punto.periodo.slice(0, 4)));
  const anio = aniosEnRango.size === 1 ? [...aniosEnRango][0] : undefined;
  const title = anio ? `Evolutivo Vistas ${anio}` : "Evolutivo Vistas";

  return (
    <DashboardCard title={title} className="md:col-span-2">
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isEmpty={query.data?.length === 0}
        onRetry={query.refetch}
        loadingFallback={<Skeleton className="h-72 w-full" />}
      >
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={query.data ?? []} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
              <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatCompactNumber} tick={{ fontSize: 12 }} width={64} />
              <Tooltip
                formatter={(value: number) => formatCompactNumber(value)}
                labelFormatter={(label) => `Periodo: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="vistas_totales"
                name="Vistas Totales"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </QueryState>
    </DashboardCard>
  );
}
