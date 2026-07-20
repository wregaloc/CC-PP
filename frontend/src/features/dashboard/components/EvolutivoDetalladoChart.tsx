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
import { useAuth } from "@/features/auth/context/AuthContext";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useContainerWidth } from "@/features/dashboard/hooks/useContainerWidth";
import { useEvolutivo } from "@/features/dashboard/hooks/useEvolutivo";
import { formatCompactNumber, formatVistasCorto } from "@/features/dashboard/lib/formatters";
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
const FORECAST_LINE_COLOR = "#8fb4c9"; // celeste apagado — se distingue a propósito del dorado
// de "vistas reales"/"emisiones", para que la proyección nunca se confunda con un dato real.

/** Granularidades para las que el backend puede calcular una proyección
 * (ver forecast_service — a nivel día es demasiado ruidoso, a nivel año no
 * hay sub-puntos que proyectar dentro del propio año). */
const GRANULARIDADES_CON_FORECAST: Granularidad[] = ["semana", "mes"];

interface VistasLabelProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: number | string;
  formatValue?: (value: number) => string;
}

/** Umbral de píxeles disponibles por barra por debajo del cual se abrevia el
 * número (353,355,972 → 353M) en vez de mostrarlo completo — con muchas
 * barras (rango largo o granularidad fina) el número completo se superpone
 * con la barra vecina o con la etiqueta de la línea de Emisiones. */
const COMPACT_LABEL_THRESHOLD_PX = 70;

/** Label del valor de "Vistas Totales" sobre cada barra, renderizado a mano
 * en vez de usar `position="insideTop"` de LabelList: cuando solo hay una
 * barra (rango filtrado a un único mes/semana/día), Recharts le pasa a esa
 * posición el ancho completo de la barra como prop `width`, lo que activa
 * su lógica interna de word-wrap/ajuste de texto (pensada para etiquetas
 * largas) y termina distorsionando un número simple. Un `content` custom
 * evita esa lógica por completo — ver Text.js::getWordsByLines en
 * node_modules/recharts. */
function VistasLabel({ x, y, width, value, formatValue = formatCompactNumber }: VistasLabelProps) {
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
      {formatValue(Number(value))}
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
  // `granularidad` vive en el contexto (no local) porque el panel "Horario
  // de Mayor Audiencia" también la necesita — ver DashboardFiltersContext.
  const { filters, setFechaInicio, setFechaFin, granularidad, setGranularidad } =
    useDashboardFilters();
  const [metricaSecundaria, setMetricaSecundaria] = useState<MetricaSecundaria>("emisiones");
  const [containerRef, containerWidth] = useContainerWidth<HTMLDivElement>();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [verProyeccion, setVerProyeccion] = useState(false);
  const forecastDisponible = GRANULARIDADES_CON_FORECAST.includes(granularidad);
  const incluirForecast = isAdmin && verProyeccion && forecastDisponible;

  const query = useEvolutivo({
    ...filters,
    granularidad,
    metrica_secundaria: metricaSecundaria,
    incluir_forecast: incluirForecast,
  });

  const chartData = useMemo(() => {
    const data = query.data ?? [];
    const primerProyectadoIndex = data.findIndex((punto) => punto.es_proyectado);
    return data.map((punto, idx) => ({
      ...punto,
      rango: punto.es_proyectado ? null : rangoFromPeriodo(punto.periodo, granularidad),
      vistas_reales: punto.es_proyectado ? undefined : punto.vistas_totales,
      // El punto real justo antes de la proyección repite su valor acá
      // para que la línea punteada arranque pegada a la última barra real,
      // sin un salto visual en el medio.
      vistas_proyectadas:
        punto.es_proyectado || idx === primerProyectadoIndex - 1 ? punto.vistas_totales : undefined,
    }));
  }, [query.data, granularidad]);

  // Antes de la primera medición (containerWidth === 0) se asume espacio
  // completo, para no mostrar un flash abreviado en el primer render.
  const pxPerBar = containerWidth > 0 ? containerWidth / Math.max(chartData.length, 1) : Infinity;
  const formatValue = pxPerBar < COMPACT_LABEL_THRESHOLD_PX ? formatVistasCorto : formatCompactNumber;

  const metricaLabel = METRICA_TABS.find((tab) => tab.value === metricaSecundaria)?.label ?? "";
  const hayProyeccion = chartData.some((punto) => punto.es_proyectado);

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

          {isAdmin && (
            <div className={TAB_GROUP_CLASS} role="group" aria-label="Proyección de vistas">
              <button
                type="button"
                aria-pressed={verProyeccion}
                disabled={!forecastDisponible}
                title={
                  forecastDisponible
                    ? "Proyecta vistas hasta fin de año, calculada sobre los datos reales filtrados"
                    : "Disponible solo con granularidad Semana o Mes"
                }
                onClick={() => setVerProyeccion((prev) => !prev)}
                className={tabButtonClass(verProyeccion, !forecastDisponible ? "opacity-40 cursor-not-allowed" : "")}
              >
                Ver proyección
              </button>
            </div>
          )}
        </div>
      }
    >
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Haz clic en una barra para filtrar toda la página por ese período.
        {hayProyeccion && " La línea punteada es una proyección, no un dato real."}
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
        <div ref={containerRef} className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 24, right: 48, left: 48, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
              <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
              {/* Dos ejes Y independientes: vistas_totales está en millones y
                  metrica_secundaria en miles — compartir un solo eje aplastaba
                  la línea contra el piso del gráfico. */}
              <YAxis yAxisId="vistas" hide />
              <YAxis yAxisId="metrica" orientation="right" hide domain={["auto", "auto"]} />
              <Tooltip
                formatter={(value: number) => (value == null ? "—" : formatCompactNumber(value))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                yAxisId="vistas"
                dataKey="vistas_reales"
                name="Vistas Totales"
                fill={BAR_COLOR}
                fillOpacity={BAR_OPACITY}
                shape={BarWithTopBorder}
                activeBar={{ fill: BAR_HOVER_COLOR, fillOpacity: BAR_OPACITY }}
                cursor="pointer"
              >
                <LabelList
                  dataKey="vistas_reales"
                  content={(props: VistasLabelProps) => <VistasLabel {...props} formatValue={formatValue} />}
                />
                {chartData.map((punto) => {
                  const isSelected =
                    !!punto.rango &&
                    filters.fecha_inicio === punto.rango.from &&
                    filters.fecha_fin === punto.rango.to;
                  return (
                    <Cell
                      key={punto.periodo}
                      fill={BAR_COLOR}
                      fillOpacity={BAR_OPACITY}
                      stroke={isSelected ? "#fff" : undefined}
                      strokeWidth={isSelected ? 2 : 0}
                      onClick={punto.rango ? () => handleBarClick(punto.rango!) : undefined}
                    />
                  );
                })}
              </Bar>
              {hayProyeccion && (
                <Line
                  yAxisId="vistas"
                  type="monotone"
                  dataKey="vistas_proyectadas"
                  name="Proyección (resto del año)"
                  stroke={FORECAST_LINE_COLOR}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 3, fill: FORECAST_LINE_COLOR, stroke: FORECAST_LINE_COLOR }}
                  connectNulls
                />
              )}
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
                  formatter={(value: number) => (value == null ? "" : formatValue(value))}
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
