import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChartTooltip } from "@/features/dashboard/components/ChartTooltip";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { KpiCard } from "@/features/dashboard/components/KpiCard";
import type { KpiAccent } from "@/features/dashboard/components/KpiCard";
import { formatPercent } from "@/features/dashboard/lib/formatters";
import { computeMomDeltaPuntos, computeMomRange } from "@/features/dashboard/lib/sentimentTrend";
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

/** "Favorable" depende de la categoría: para Negativo, bajar es la buena
 * noticia — nunca colorear por el signo aritmético sin pasar por esta regla. */
function getMomColorClass(rounded: number, accent: KpiAccent): string {
  if (rounded === 0 || accent === "neutral") {
    return "text-neutral-500 dark:text-neutral-400";
  }
  const isUp = rounded > 0;
  const isFavorable = accent === "positivo" ? isUp : !isUp;
  return isFavorable ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
}

function MomIndicator({ deltaPuntos, accent }: { deltaPuntos: number | null; accent: KpiAccent }) {
  if (deltaPuntos === null) {
    return <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">—</span>;
  }

  const rounded = Math.round(deltaPuntos * 10) / 10;
  const arrow = rounded > 0 ? "▲" : rounded < 0 ? "▼" : "→";
  const sign = rounded > 0 ? "+" : "";

  return (
    <span className={`text-[11px] font-semibold ${getMomColorClass(rounded, accent)}`}>
      {arrow} {sign}
      {rounded.toFixed(1)} p.p.
    </span>
  );
}

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

  // El indicador MoM (▲/▼ p.p.) no debe depender del ancho del rango que
  // eligió el usuario en el filtro global — si filtra un solo mes, igual
  // tiene que poder comparar contra el mes anterior. Se pide un rango propio
  // anclado en fecha_fin (o fecha_inicio si no hay fecha_fin) en vez de
  // reusar evolutivoQuery.data, que respeta el filtro visible del gráfico.
  const referenceDate = filters.fecha_fin ?? filters.fecha_inicio;
  const momRange = computeMomRange(referenceDate);
  const momFilters = momRange
    ? { fecha_inicio: momRange.fecha_inicio, fecha_fin: momRange.fecha_fin, programa: filters.programa }
    : sentimentFilters; // sin fecha elegida: mismo comportamiento de antes (últimos 2 meses disponibles)
  const momQuery = useSentimientoEvolutivo(momFilters);

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
              trailing={
                <MomIndicator
                  deltaPuntos={computeMomDeltaPuntos(momQuery.data, "pct_positivo")}
                  accent="positivo"
                />
              }
            />
            <KpiCard
              label="Negativo"
              value={formatPercent(query.data.pct_negativo)}
              description="SPLIT SENSE[Sentimiento Negativo]"
              accent="negativo"
              trailing={
                <MomIndicator
                  deltaPuntos={computeMomDeltaPuntos(momQuery.data, "pct_negativo")}
                  accent="negativo"
                />
              }
            />
            <KpiCard
              label="Neutral"
              value={formatPercent(query.data.pct_neutral)}
              description="SPLIT SENSE[Sentimiento Neutral]"
              accent="neutral"
              trailing={
                <MomIndicator
                  deltaPuntos={computeMomDeltaPuntos(momQuery.data, "pct_neutral")}
                  accent="neutral"
                />
              }
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
                content={
                  <ChartTooltip
                    labelFormatter={(label) => `Mes: ${label}`}
                    valueFormatter={(value) => formatPercent(value)}
                  />
                }
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
