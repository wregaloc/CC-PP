import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { TextField } from "@/components/ui/TextField";
import { ChartTooltip } from "@/features/dashboard/components/ChartTooltip";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { RankingTable } from "@/features/dashboard/components/RankingTable";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useContainerWidth } from "@/features/dashboard/hooks/useContainerWidth";
import { useRankingProgramas } from "@/features/dashboard/hooks/useRankingProgramas";
import { colorForTipo, TIPO_COLOR } from "@/features/dashboard/lib/tipoColors";
import { formatCompactNumber } from "@/features/dashboard/lib/formatters";
import { TAB_GROUP_CLASS, tabButtonClass } from "@/features/dashboard/lib/tabStyles";
import type { Formato, ProgramType } from "@/features/dashboard/types";

const MAX_BARS_SHOWN = 10;
const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 350;
type ViewMode = "grafico" | "tabla";

interface ProgramaTickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
  /** Máximo de caracteres antes de truncar con "…" — en un eje angosto
   * (mobile) el nombre completo se corta contra el borde izquierdo del SVG
   * en vez de superponerse, así que hay que acortarlo a mano. */
  maxChars?: number;
}

/** Tick del eje Y con clase Tailwind `dark:` (no un `fill` fijo): el objeto
 * `tick={{ fill: ... }}` de Recharts solo admite un color hardcodeado, que
 * se veía bien sobre el fondo oscuro pero quedaba ilegible en tema claro. */
function ProgramaTick({ x, y, payload, maxChars }: ProgramaTickProps) {
  if (x === undefined || y === undefined || !payload) return null;
  const label =
    maxChars && payload.value.length > maxChars
      ? `${payload.value.slice(0, maxChars - 1)}…`
      : payload.value;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} className="fill-neutral-700 dark:fill-neutral-200">
      <title>{payload.value}</title>
      {label}
    </text>
  );
}

// Valores reales de DATA[Formato] confirmados por el usuario: Grabado, Vivo,
// Finalizado (no se asume agrupación entre ellos — se muestran tal cual
// están en el dato, ver conversación de aprobación). El tab "Finalizado" se
// quitó de la UI a pedido del usuario; "Todos" sigue incluyendo esas filas.
const FORMATO_TABS: { value: Formato | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "Grabado", label: "Grabado" },
  { value: "Vivo", label: "Vivo" },
];

// Exploratorio (a pedido del usuario, "solo para ver cómo queda"): filtro
// excluyente por tipo, alternativo al coloreado simultáneo ya aprobado
// (Propuesta 1). El endpoint ya soportaba `tipo` desde antes de esa
// propuesta, así que no requiere cambios de contrato.
// Vive en DashboardFiltersContext (no como estado local de este panel) para
// que Evolutivo Detallado también filtre por tipo al mismo tiempo.
const TIPO_TABS: { value: ProgramType | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "podcast", label: "Podcast" },
  { value: "programa", label: "Programa" },
];

/** Ranking horizontal PROGRAMAS + VISTAS TOTALES — Doc-Migración §5.1: cada
 * barra se colorea por `tipo` simultáneamente (no como filtro excluyente,
 * ver Propuesta 1 aprobada), con filtro por `formato` (Propuesta 2 aprobada)
 * y buscador de programas integrado.
 * El buscador consulta al backend (`q`, con debounce) en vez de filtrar en
 * el cliente: la base tiene 1000+ programas y este panel solo trae el top
 * 100 por vistas, así que un programa fuera de ese top 100 era imposible de
 * encontrar filtrando solo lo ya traído. */
export function RankingProgramasPanel({ className }: { className?: string }) {
  const { filters, setPrograma, setTipo } = useDashboardFilters();
  const [formato, setFormato] = useState<Formato | "">("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [view, setView] = useState<ViewMode>("grafico");
  const [chartRef, chartWidth] = useContainerWidth<HTMLDivElement>();
  // Antes de la primera medición se asume el ancho completo (140px), igual
  // criterio que el resto de charts del dashboard con esta misma técnica.
  const yAxisWidth = chartWidth > 0 && chartWidth < 420 ? 90 : 140;
  const yAxisMaxChars = Math.max(6, Math.floor(yAxisWidth / 6.5));

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // El buscador es estado local (no vive en DashboardFiltersContext), así
  // que "Limpiar filtros" en la barra superior no lo tocaba por sí solo: el
  // programa filtrado se limpiaba pero el `q` local seguía acotando este
  // panel a lo último buscado. Se limpia en cuanto `filters.programa` queda
  // vacío (por "Limpiar filtros" o por elegir "Todos" manualmente).
  useEffect(() => {
    if (!filters.programa) {
      setSearch("");
      setDebouncedSearch("");
    }
  }, [filters.programa]);

  const q = debouncedSearch.length >= MIN_SEARCH_LENGTH ? debouncedSearch : undefined;

  const query = useRankingProgramas({
    fecha_inicio: filters.fecha_inicio,
    fecha_fin: filters.fecha_fin,
    canal: filters.canal,
    categoria: filters.categoria,
    formato: formato || undefined,
    tipo: filters.tipo,
    limit: 100,
    q,
    programa_asegurado: filters.programa,
  });

  const filtered = query.data ?? [];

  // El gráfico solo muestra el top N por espacio, así que si el programa
  // filtrado arriba queda fuera de ese top N, se agrega igual al final —
  // si no, seleccionar un programa "de cola" no mostraba ningún cambio
  // visible acá (aunque el resto del dashboard sí filtraba por él).
  const chartData = useMemo(() => {
    const top = filtered.slice(0, MAX_BARS_SHOWN);
    if (!filters.programa || top.some((item) => item.programa === filters.programa)) {
      return top;
    }
    const seleccionado = filtered.find((item) => item.programa === filters.programa);
    return seleccionado ? [...top, seleccionado] : top;
  }, [filtered, filters.programa]);

  return (
    <DashboardCard
      title="Ranking de Programas por Vistas Totales"
      className={className}
      action={
        <div className={TAB_GROUP_CLASS} role="tablist" aria-label="Filtrar por formato">
          {FORMATO_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={formato === tab.value}
              onClick={() => setFormato(tab.value)}
              className={tabButtonClass(formato === tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      }
    >
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Haz clic en un programa (barra o fila) para filtrar todo el dashboard por él.
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <TextField
          label="Buscar programa"
          placeholder="Escribe el nombre de un programa y presiona Enter…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && filtered.length === 1) {
              setPrograma(filtered[0].programa);
            }
          }}
        />

        <div className="flex items-center gap-4">
          <div className={TAB_GROUP_CLASS} role="tablist" aria-label="Filtrar por tipo">
            {TIPO_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={(filters.tipo ?? "") === tab.value}
                onClick={() => setTipo(tab.value || undefined)}
                className={tabButtonClass((filters.tipo ?? "") === tab.value, "flex items-center gap-1.5")}
              >
                {tab.value && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: TIPO_COLOR[tab.value] }}
                    aria-hidden="true"
                  />
                )}
                {tab.label}
              </button>
            ))}
          </div>

          <div className={TAB_GROUP_CLASS} role="tablist" aria-label="Tipo de vista">
            {(["grafico", "tabla"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={view === mode}
                onClick={() => setView(mode)}
                className={tabButtonClass(view === mode, "capitalize")}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isEmpty={filtered.length === 0}
        emptyMessage="No hay programas que coincidan con el filtro."
        onRetry={query.refetch}
        loadingFallback={<Skeleton className="h-80 w-full" />}
      >
        {view === "grafico" ? (
          <div ref={chartRef} className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
                <XAxis type="number" tickFormatter={formatCompactNumber} tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="programa"
                  width={yAxisWidth}
                  tick={<ProgramaTick maxChars={yAxisMaxChars} />}
                  interval={0}
                />
                <Tooltip content={<ChartTooltip valueFormatter={formatCompactNumber} />} />
                <Bar dataKey="vistas_totales" name="Vistas Totales" radius={[0, 4, 4, 0]} cursor="pointer">
                  {chartData.map((entry) => (
                    <Cell
                      key={`${entry.programa}-${entry.canal}`}
                      fill={colorForTipo(entry.tipo)}
                      stroke={filters.programa === entry.programa ? "#fff" : undefined}
                      strokeWidth={filters.programa === entry.programa ? 2 : 0}
                      onClick={() => setPrograma(entry.programa)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <RankingTable items={filtered} onSelectPrograma={setPrograma} selectedPrograma={filters.programa} />
        )}
      </QueryState>
    </DashboardCard>
  );
}
