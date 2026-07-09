import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { KpiCard } from "@/features/dashboard/components/KpiCard";
import { formatPercent } from "@/features/dashboard/lib/formatters";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useSentimentKpis } from "@/features/dashboard/hooks/useSentimentKpis";
import { useSentimientoEvolutivo } from "@/features/dashboard/hooks/useSentimentoEvolutivo";

// Mismos colores que las KpiCard de arriba (text-green-600/red-600/neutral-500
// en Tailwind) — Recharts dibuja en SVG y necesita el hex directo, no puede
// tomar la clase de Tailwind.
const SENTIMENT_LINE_COLORS = {
  pct_positivo: "#16a34a",
  pct_negativo: "#dc2626",
  pct_neutral: "#9ca3af",
} as const;

/** KPI Cards de Sentimiento — Doc-Migración §5.1: Sentimiento
 * Positivo/Negativo/Neutral, medidas SPLIT SENSE[Sentimiento *]. */
export function SentimentKpiCards() {
  const { filters } = useDashboardFilters();
  const sentimentFilters = {
    fecha_inicio: filters.fecha_inicio,
    fecha_fin: filters.fecha_fin,
    programa: filters.programa,
  };
  const query = useSentimentKpis(sentimentFilters);
  const evolutivoQuery = useSentimientoEvolutivo(sentimentFilters);

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

      <QueryState
        isLoading={evolutivoQuery.isLoading}
        isError={evolutivoQuery.isError}
        error={evolutivoQuery.error}
        isEmpty={evolutivoQuery.data?.length === 0}
        emptyMessage="No hay evolución de sentimiento para este filtro."
        onRetry={evolutivoQuery.refetch}
        loadingFallback={<Skeleton className="h-56 w-full" />}
      >
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={evolutivoQuery.data ?? []}
              margin={{ top: 8, right: 24, left: 24, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis domain={["auto", "auto"]} hide />
              <Tooltip
                formatter={(value: number, name: string) => [formatPercent(value), name]}
                labelFormatter={(label) => `Mes: ${label}`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="pct_positivo"
                name="Positivo"
                stroke={SENTIMENT_LINE_COLORS.pct_positivo}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="pct_negativo"
                name="Negativo"
                stroke={SENTIMENT_LINE_COLORS.pct_negativo}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="pct_neutral"
                name="Neutral"
                stroke={SENTIMENT_LINE_COLORS.pct_neutral}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </QueryState>
    </DashboardCard>
  );
}
