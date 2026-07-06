import { Alert } from "@/components/ui/Alert";
import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { useAuspicios } from "@/features/dashboard/hooks/useAuspicios";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { formatCompactNumber } from "@/features/dashboard/lib/formatters";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function mesFromFechaInicio(fechaInicio: string | undefined): number | undefined {
  if (!fechaInicio) return undefined;
  const mes = Number(fechaInicio.split("-")[1]);
  return Number.isInteger(mes) && mes >= 1 && mes <= 12 ? mes : undefined;
}

/**
 * Panel AUSPICIOS — Doc-Migración §5.1: "muestra la lista de marcas
 * auspiciadoras filtradas por el contexto actual (programa/canal/mes)".
 * El endpoint ya acepta `mes` como filtro — se deriva del "Desde" de la
 * barra de filtros compartida en vez de agregar un selector de mes propio,
 * para no duplicar controles de fecha en la UI.
 * Sin un programa seleccionado, el endpoint devolvería todos los
 * auspiciadores del dataset completo (cientos de marcas) — una lista así no
 * es un KPI de contexto, es ruido. Por eso este panel solo consulta y
 * muestra datos cuando hay un `programa` elegido en la barra de filtros;
 * sin programa, invita explícitamente a elegir uno en vez de listar todo.
 */
export function AuspiciosPanel() {
  const { filters } = useDashboardFilters();
  const hasPrograma = Boolean(filters.programa);
  const mes = mesFromFechaInicio(filters.fecha_inicio);
  const query = useAuspicios({ programa: filters.programa, mes }, hasPrograma);

  const contexto = mes ? `${filters.programa} en ${MESES[mes - 1]}` : `${filters.programa}`;

  return (
    <DashboardCard title="Auspicios">
      {!hasPrograma ? (
        <Alert variant="info">Elige un programa en los filtros para ver sus auspiciadores.</Alert>
      ) : (
        <QueryState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          isEmpty={query.data?.length === 0}
          emptyMessage={`${contexto} no tiene auspiciadores registrados.`}
          onRetry={query.refetch}
          loadingFallback={
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="h-12 w-24" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          }
        >
          {query.data && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-5
                dark:border-neutral-800 dark:bg-neutral-950">
                <span className="text-4xl font-bold text-neutral-900 dark:text-neutral-100">
                  {formatCompactNumber(query.data.length)}
                </span>
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  auspiciador{query.data.length === 1 ? "" : "es"} de {contexto}
                </span>
              </div>

              <ul className="flex flex-wrap gap-2">
                {query.data.map((auspicio) => (
                  <li
                    key={auspicio.auspiciador}
                    className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-800
                      dark:bg-neutral-800 dark:text-neutral-200"
                  >
                    {auspicio.auspiciador}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </QueryState>
      )}
    </DashboardCard>
  );
}
