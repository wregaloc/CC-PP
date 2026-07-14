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
import { TAB_GROUP_CLASS, tabButtonClass } from "@/features/dashboard/lib/tabStyles";
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

const BAR_COLOR = "#4a453d";
const BAR_OPACITY = 0.9;
const BAR_HOVER_COLOR = "#5c564a";
const BAR_TOP_BORDER_COLOR = "rgba(180,151,90,0.3)";
const LINE_COLOR = "#d8bc82"; // oro claro — antes amarillo (#eab308), Doc-Migración §5.2: "Línea = Emisiones"
const LINE_DOT_COLOR = "#b4975a";
const BAR_LABEL_COLOR = "#f5f1e8";

interface VistasLabelProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: number | string;
}

/** Label del valor de "Vistas Totales" sobre cada barra, renderizado a mano
 * en vez de usar `position="insideTop"` de LabelList: cuando solo hay una
 * barra (rango filtrado a un único mes/semana/día), Recharts le pasa a esa
 * posición el ancho completo de la barra como prop `width`, lo que activa
 * su lógica interna de word-wrap/ajuste de texto (pensada para etiquetas
 * largas) y termina distorsionando un número simple. Un `content` custom
 * evita esa lógica por completo — ver Text.js::getWordsByLines en
 * node_modules/recharts. */
function VistasLabel({ x, y, width, value }: VistasLabelProps) {
  if (x === undefined || y === undefined || width === undefined || value === undefined) return null;
  const numX = Number(x);
  const numY = Number(y);
  const numWidth = Number(width);
  return (
    <text
      x={numX + numWidth / 2}
      y={numY + 14}
      textAnchor="middle"
      fontSize={10}
      fontWeight={500}
      fill={BAR_LABEL_COLOR}
    >
      {formatCompactNumber(Number(value))}
    </text>
  );
}

interface BarShapeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  onClick?: () => void;
}

/** Barra con esquinas superiores redondeadas: sin selección muestra un filo
 * dorado sutil solo en el borde superior; seleccionada muestra el contorno
 * blanco completo existente (ver `isSelected` en el mapeo de `Cell`s). */
function BarWithTopBorder({ x, y, width, height, fill, fillOpacity, stroke, strokeWidth, onClick }: BarShapeProps) {
  return (
    <g onClick={onClick}>
      <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill={fill} fillOpacity={fillOpacity} />
      {stroke ? (
        <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
      ) : (
        <line x1={x} y1={y} x2={x + width} y2={y} stroke={BAR_TOP_BORDER_COLOR} strokeWidth={1} />
      )}
    </g>
  );
}

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
      action={
        <div className="flex flex-wrap items-center gap-3">
          <div className={TAB_GROUP_CLASS} role="tablist" aria-label="Granularidad temporal">
            {GRANULARIDAD_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={granularidad === tab.value}
                onClick={() => setGranularidad(tab.value)}
                className={tabButtonClass(granularidad === tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={TAB_GROUP_CLASS} role="tablist" aria-label="Métrica secundaria">
            {METRICA_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={metricaSecundaria === tab.value}
                onClick={() => setMetricaSecundaria(tab.value)}
                className={tabButtonClass(metricaSecundaria === tab.value)}
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
                fillOpacity={BAR_OPACITY}
                shape={BarWithTopBorder}
                activeBar={{ fill: BAR_HOVER_COLOR, fillOpacity: BAR_OPACITY }}
                cursor="pointer"
              >
                <LabelList dataKey="vistas_totales" content={VistasLabel} />
                {chartData.map((punto) => {
                  const isSelected =
                    filters.fecha_inicio === punto.rango.from && filters.fecha_fin === punto.rango.to;
                  return (
                    <Cell
                      key={punto.periodo}
                      fill={BAR_COLOR}
                      fillOpacity={BAR_OPACITY}
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
                dot={{ r: 3, fill: LINE_DOT_COLOR, stroke: LINE_DOT_COLOR }}
              >
                <LabelList
                  dataKey="metrica_secundaria"
                  position="top"
                  offset={12}
                  formatter={(value: number) => formatCompactNumber(value)}
                  className="text-[10px]"
                  fill={LINE_COLOR}
                />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </QueryState>
    </DashboardCard>
  );
}
