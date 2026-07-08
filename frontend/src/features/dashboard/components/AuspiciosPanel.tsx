import { useMemo } from "react";

import { Alert } from "@/components/ui/Alert";
import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { useAuspicios } from "@/features/dashboard/hooks/useAuspicios";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { formatCompactNumber } from "@/features/dashboard/lib/formatters";
import { MESES, mesesFromRango } from "@/features/dashboard/lib/mes";

const CHIP_LIST_CLASS = "flex flex-wrap gap-2";
const CHIP_CLASS =
  "rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm font-medium text-neutral-800 " +
  "dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200";

/**
 * Panel AUSPICIOS — Doc-Migración §5.1: "muestra la lista de marcas
 * auspiciadoras filtradas por el contexto actual (programa/canal/mes)".
 * El endpoint solo acepta un único `mes` — cuando el rango del date picker
 * cubre varios meses (p. ej. abril-mayo), se pide sin filtro de mes (todo
 * el histórico del programa) y se recorta en el cliente a los meses del
 * rango usando `mes_num` (ya viene en la respuesta), agrupando cada mes por
 * separado en vez de mezclarlos en una sola lista.
 * Sin un programa seleccionado, el endpoint devolvería todos los
 * auspiciadores del dataset completo (cientos de marcas) — una lista así no
 * es un KPI de contexto, es ruido. Por eso este panel solo consulta y
 * muestra datos cuando hay un `programa` elegido en la barra de filtros;
 * sin programa, invita explícitamente a elegir uno en vez de listar todo.
 */
export function AuspiciosPanel() {
  const { filters } = useDashboardFilters();
  const hasPrograma = Boolean(filters.programa);
  const meses = mesesFromRango(filters.fecha_inicio, filters.fecha_fin);
  const singleMes = meses.length === 1 ? meses[0] : undefined;

  const query = useAuspicios({ programa: filters.programa, mes: singleMes }, hasPrograma);

  const datosEnRango = useMemo(() => {
    const data = query.data ?? [];
    if (meses.length <= 1) return data;
    return data.filter((auspicio) => meses.includes(auspicio.mes_num));
  }, [query.data, meses]);

  const contexto = singleMes
    ? `${filters.programa} en ${MESES[singleMes - 1]}`
    : meses.length > 1
      ? `${filters.programa} entre ${MESES[meses[0] - 1]} y ${MESES[meses[meses.length - 1] - 1]}`
      : `${filters.programa}`;

  const gruposPorMes = useMemo(() => {
    if (singleMes) return [];
    const porMes = new Map<number, string[]>();
    for (const auspicio of datosEnRango) {
      const marcas = porMes.get(auspicio.mes_num) ?? [];
      marcas.push(auspicio.auspiciador);
      porMes.set(auspicio.mes_num, marcas);
    }
    return [...porMes.entries()]
      .sort(([a], [b]) => a - b)
      .map(([mesNum, marcas]) => ({ mesNum, marcas }));
  }, [singleMes, datosEnRango]);

  return (
    <DashboardCard title="Auspicios">
      {!hasPrograma ? (
        <Alert variant="info">Elige un programa en los filtros para ver sus auspiciadores.</Alert>
      ) : (
        <QueryState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          isEmpty={datosEnRango.length === 0}
          emptyMessage={`${contexto} no tiene auspiciadores registrados.`}
          onRetry={query.refetch}
          loadingFallback={
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="h-12 w-24" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          }
        >
          {singleMes && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-5
                dark:border-neutral-800 dark:bg-neutral-950">
                <span className="text-4xl font-bold text-neutral-900 dark:text-neutral-100">
                  {formatCompactNumber(datosEnRango.length)}
                </span>
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  auspiciador{datosEnRango.length === 1 ? "" : "es"} de {contexto}
                </span>
              </div>

              <ul className={CHIP_LIST_CLASS}>
                {datosEnRango.map((auspicio) => (
                  <li key={auspicio.auspiciador} className={CHIP_CLASS}>
                    {auspicio.auspiciador}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!singleMes && (
            <div className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
              {gruposPorMes.map((grupo) => (
                <div key={grupo.mesNum} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <h4 className="flex items-baseline gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    {MESES[grupo.mesNum - 1]}
                    <span className="font-normal normal-case text-neutral-400 dark:text-neutral-500">
                      · {grupo.marcas.length} marca{grupo.marcas.length === 1 ? "" : "s"}
                    </span>
                  </h4>
                  <ul className={CHIP_LIST_CLASS}>
                    {grupo.marcas.map((marca) => (
                      <li key={marca} className={CHIP_CLASS}>
                        {marca}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </QueryState>
      )}
    </DashboardCard>
  );
}
