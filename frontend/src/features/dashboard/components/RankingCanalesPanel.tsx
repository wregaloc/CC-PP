import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useRankingCanales } from "@/features/dashboard/hooks/useRankingCanales";
import { formatCompactNumber } from "@/features/dashboard/lib/formatters";

const MAX_BARS_SHOWN = 10;
const BAR_COLOR = "#2563eb";

/** Ranking horizontal CANALES + VISTAS TOTALES — Doc-Migración §5.2 "Ranking
 * Canales (izquierda)": medida Ranking Dinámico, misma interacción de
 * cross-filter que el ranking de programas de la Página 1 (clic en una
 * barra/fila fija `filters.canal`), que alimenta el "Panel Derecho — Detalle
 * de Canal Seleccionado". */
export function RankingCanalesPanel() {
  const { filters, setCanal } = useDashboardFilters();
  const query = useRankingCanales({
    fecha_inicio: filters.fecha_inicio,
    fecha_fin: filters.fecha_fin,
    limit: 100,
  });

  const chartData = (query.data ?? []).slice(0, MAX_BARS_SHOWN);

  return (
    <DashboardCard title="Ranking de Canales por Vistas Totales">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Haz clic en un canal para ver su detalle en el panel derecho.
      </p>

      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isEmpty={chartData.length === 0}
        emptyMessage="No hay canales para este filtro."
        onRetry={query.refetch}
        loadingFallback={<Skeleton className="h-80 w-full" />}
      >
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
              <XAxis type="number" tickFormatter={formatCompactNumber} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="canal" width={140} tick={{ fontSize: 12 }} interval={0} />
              <Tooltip formatter={(value: number) => formatCompactNumber(value)} />
              <Bar dataKey="vistas_totales" name="Vistas Totales" radius={[0, 4, 4, 0]} cursor="pointer">
                {chartData.map((entry) => (
                  <Cell
                    key={entry.canal}
                    fill={BAR_COLOR}
                    stroke={filters.canal === entry.canal ? "#fff" : undefined}
                    strokeWidth={filters.canal === entry.canal ? 2 : 0}
                    onClick={() => setCanal(entry.canal)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </QueryState>
    </DashboardCard>
  );
}
