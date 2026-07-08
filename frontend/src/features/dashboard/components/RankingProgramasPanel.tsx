import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { TextField } from "@/components/ui/TextField";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { RankingTable } from "@/features/dashboard/components/RankingTable";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useRankingProgramas } from "@/features/dashboard/hooks/useRankingProgramas";
import { colorForTipo, TIPO_COLOR } from "@/features/dashboard/lib/tipoColors";
import { formatCompactNumber } from "@/features/dashboard/lib/formatters";
import type { Formato, ProgramType } from "@/features/dashboard/types";

const MAX_BARS_SHOWN = 10;
type ViewMode = "grafico" | "tabla";

// Valores reales de DATA[Formato] confirmados por el usuario: Grabado, Vivo,
// Finalizado (no se asume agrupación entre ellos — se muestran los 3 tal
// cual están en el dato, ver conversación de aprobación).
const FORMATO_TABS: { value: Formato | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "Grabado", label: "Grabado" },
  { value: "Vivo", label: "Vivo" },
  { value: "Finalizado", label: "Finalizado" },
];

// Exploratorio (a pedido del usuario, "solo para ver cómo queda"): filtro
// excluyente por tipo, alternativo al coloreado simultáneo ya aprobado
// (Propuesta 1). El endpoint ya soportaba `tipo` desde antes de esa
// propuesta, así que no requiere cambios de contrato.
const TIPO_TABS: { value: ProgramType | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "podcast", label: "Podcast" },
  { value: "programa", label: "Programa" },
];

/** Ranking horizontal PROGRAMAS + VISTAS TOTALES — Doc-Migración §5.1: cada
 * barra se colorea por `tipo` simultáneamente (no como filtro excluyente,
 * ver Propuesta 1 aprobada), con filtro por `formato` (Propuesta 2 aprobada)
 * y buscador de programas integrado. El buscador filtra en el cliente sobre
 * el conjunto ya traído (la API no expone un parámetro de búsqueda de texto). */
export function RankingProgramasPanel() {
  const { filters, setPrograma } = useDashboardFilters();
  const [formato, setFormato] = useState<Formato | "">("");
  const [tipo, setTipo] = useState<ProgramType | "">("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("grafico");

  const query = useRankingProgramas({
    fecha_inicio: filters.fecha_inicio,
    fecha_fin: filters.fecha_fin,
    canal: filters.canal,
    formato: formato || undefined,
    tipo: tipo || undefined,
    limit: 100,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const data = query.data ?? [];
    return term ? data.filter((item) => item.programa.toLowerCase().includes(term)) : data;
  }, [query.data, search]);

  const chartData = filtered.slice(0, MAX_BARS_SHOWN);

  return (
    <DashboardCard
      title="Ranking de Programas por Vistas Totales"
      action={
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtrar por formato">
          {FORMATO_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={formato === tab.value}
              onClick={() => setFormato(tab.value)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                formato === tab.value
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              }`}
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
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtrar por tipo">
            {TIPO_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={tipo === tab.value}
                onClick={() => setTipo(tab.value)}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  tipo === tab.value
                    ? "bg-blue-600 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
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

          <div className="flex gap-1" role="tablist" aria-label="Tipo de vista">
            {(["grafico", "tabla"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={view === mode}
                onClick={() => setView(mode)}
                className={`rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors ${
                  view === mode
                    ? "bg-blue-600 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
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
          <div className="h-80 w-full">
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
                  width={140}
                  tick={{ fontSize: 12 }}
                  interval={0}
                />
                <Tooltip formatter={(value: number) => formatCompactNumber(value)} />
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
