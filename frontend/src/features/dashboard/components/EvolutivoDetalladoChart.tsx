import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useEvolutivo } from "@/features/dashboard/hooks/useEvolutivo";
import { formatCompactNumber } from "@/features/dashboard/lib/formatters";
import { rangoFromPeriodo } from "@/features/dashboard/lib/periodo";
import type { Granularidad, MetricaSecundaria } from "@/features/dashboard/types";

const GRANULARIDAD_TABS: { value: Granularidad; label: string }[] = [
  { value: "anio", label: "Año" },
  { value: "mes", label: "Mes" },
  { value: "semana", label: "Semana" },
  { value: "dia", label: "Día" },
];

const METRICA_TABS: { value: MetricaSecundaria; label: string }[] = [
  { value: "busquedas", label: "Búsquedas" },
  { value: "emisiones", label: "Emisiones" },
];

const BAR_COLOR = "#2563eb";
const LINE_COLOR = "#eab308"; // amarillo — Doc-Migración §5.2: "Línea amarilla = Emisiones"

/**
 * Gráfico combinado (barras + línea) — Doc-Migración §5.2 "Evolutivo
 * Detallado": barras = Vistas Totales, línea amarilla = Emisiones o
 * Búsquedas según selección, con segmentadores de granularidad temporal y
 * tipo. Se usa en el Dashboard (Página 1, junto a Auspicios) — reemplazó al
 * antiguo "Evolutivo Vistas" (línea simple con granularidad fija).
 */
export function EvolutivoDetalladoChart() {
  const { filters, setFechaInicio, setFechaFin } = useDashboardFilters();
  const [granularidad, setGranularidad] = useState<Granularidad>("mes");
  const [metricaSecundaria, setMetricaSecundaria] = useState<MetricaSecundaria>("emisiones");

  const query = useEvolutivo({ ...filters, granularidad, metrica_secundaria: metricaSecundaria });

  const chartData = useMemo(() => {
    const data = query.data ?? [];
    return data.map((punto) => ({ ...punto, rango: rangoFromPeriodo(punto.periodo, granularidad) }));
  }, [query.data, granularidad]);

  const metricaLabel = METRICA_TABS.find((tab) => tab.value === metricaSecundaria)?.label ?? "";

  function handleBarClick(rangoPunto: { from: string; to: string }) {
    setFechaInicio(rangoPunto.from);
    setFechaFin(rangoPunto.to);
  }

  return (
    <DashboardCard
      title="Evolutivo Detallado"
      className="md:col-span-2"
      action={
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Granularidad temporal">
            {GRANULARIDAD_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={granularidad === tab.value}
                onClick={() => setGranularidad(tab.value)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  granularidad === tab.value
                    ? "bg-blue-600 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Métrica secundaria">
            {METRICA_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={metricaSecundaria === tab.value}
                onClick={() => setMetricaSecundaria(tab.value)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  metricaSecundaria === tab.value
                    ? "bg-yellow-500 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Haz clic en una barra para filtrar toda la página por ese período.
      </p>

      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isEmpty={chartData.length === 0}
        emptyMessage="No hay datos para este filtro."
        onRetry={query.refetch}
        loadingFallback={<Skeleton className="h-80 w-full" />}
      >
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 24, right: 48, left: 48, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
              <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
              {/* Dos ejes Y independientes: vistas_totales está en millones y
                  metrica_secundaria en miles — compartir un solo eje aplastaba
                  la línea contra el piso del gráfico. */}
              <YAxis yAxisId="vistas" hide />
              <YAxis yAxisId="metrica" orientation="right" hide domain={["auto", "auto"]} />
              <Tooltip formatter={(value: number) => formatCompactNumber(value)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                yAxisId="vistas"
                dataKey="vistas_totales"
                name="Vistas Totales"
                fill={BAR_COLOR}
                radius={[4, 4, 0, 0]}
                cursor="pointer"
              >
                <LabelList
                  dataKey="vistas_totales"
                  position="insideTop"
                  offset={8}
                  formatter={(value: number) => formatCompactNumber(value)}
                  className="fill-white text-[10px] font-medium"
                />
                {chartData.map((punto) => {
                  const isSelected =
                    filters.fecha_inicio === punto.rango.from && filters.fecha_fin === punto.rango.to;
                  return (
                    <Cell
                      key={punto.periodo}
                      fill={BAR_COLOR}
                      stroke={isSelected ? "#fff" : undefined}
                      strokeWidth={isSelected ? 2 : 0}
                      onClick={() => handleBarClick(punto.rango)}
                    />
                  );
                })}
              </Bar>
              <Line
                yAxisId="metrica"
                type="monotone"
                dataKey="metrica_secundaria"
                name={metricaLabel}
                stroke={LINE_COLOR}
                strokeWidth={2}
                dot={{ r: 3 }}
              >
                <LabelList
                  dataKey="metrica_secundaria"
                  position="top"
                  offset={12}
                  formatter={(value: number) => formatCompactNumber(value)}
                  className="fill-yellow-600 text-[10px] dark:fill-yellow-400"
                />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </QueryState>
    </DashboardCard>
  );
}
