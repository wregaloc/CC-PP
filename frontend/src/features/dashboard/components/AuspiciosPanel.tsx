import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { useAuspicios } from "@/features/dashboard/hooks/useAuspicios";
import { useAuspiciosBusqueda } from "@/features/dashboard/hooks/useAuspiciosBusqueda";
import { useTopAuspiciadores } from "@/features/dashboard/hooks/useTopAuspiciadores";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { formatCompactNumber } from "@/features/dashboard/lib/formatters";
import { MESES, mesesFromRango } from "@/features/dashboard/lib/mes";
import { TAB_GROUP_CLASS, tabButtonClass } from "@/features/dashboard/lib/tabStyles";

const CHIP_LIST_CLASS = "flex flex-wrap gap-2";
const CHIP_CLASS =
  "rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm font-medium text-neutral-800 " +
  "dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200";
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 350;

/** Banner informativo con acento oro/carbón — sustituye a <Alert variant="info">
 * solo dentro de este panel (cambio acotado, ver decisión con el usuario:
 * no se tocó el componente Alert compartido ni otros paneles). */
function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-stretch gap-3 rounded-md border border-[rgba(180,151,90,0.35)] bg-[rgba(180,151,90,0.08)]
        px-4 py-3 text-sm text-neutral-800
        dark:border-[rgba(180,151,90,0.25)] dark:bg-[#1a1714] dark:text-[#f5f1e8]"
    >
      <span aria-hidden="true" className="w-1 shrink-0 rounded-full bg-[#b4975a]" />
      <span>{children}</span>
    </div>
  );
}

type Modo = "programa" | "auspiciador";

/**
 * Panel AUSPICIOS — Doc-Migración §5.1: "muestra la lista de marcas
 * auspiciadoras filtradas por el contexto actual (programa/canal/mes)".
 * Dos modos:
 * - "Por Programa" (comportamiento original): requiere elegir un programa
 *   en la barra de filtros y lista sus auspiciadores.
 * - "Por Auspiciador" (búsqueda inversa): texto libre (ej. "BCP") que busca
 *   en qué programas/canales aparece esa marca, sin necesidad de programa
 *   elegido — usa /dashboard/auspicios/buscar.
 * Ambos modos comparten la misma regla de agrupar por mes en el cliente
 * cuando el rango de fechas cubre varios meses (el backend solo filtra por
 * un único `mes`, ver AuspiciosPanel original y mesesFromRango).
 */
export function AuspiciosPanel() {
  const { filters } = useDashboardFilters();
  const [modo, setModo] = useState<Modo>("programa");
  const meses = mesesFromRango(filters.fecha_inicio, filters.fecha_fin);
  const singleMes = meses.length === 1 ? meses[0] : undefined;

  return (
    <DashboardCard
      title="Auspicios"
      action={
        <div className={TAB_GROUP_CLASS} role="tablist" aria-label="Modo de búsqueda de auspicios">
          <button
            type="button"
            role="tab"
            aria-selected={modo === "programa"}
            onClick={() => setModo("programa")}
            className={tabButtonClass(modo === "programa")}
          >
            Por Programa
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === "auspiciador"}
            onClick={() => setModo("auspiciador")}
            className={tabButtonClass(modo === "auspiciador")}
          >
            Por Auspiciador
          </button>
        </div>
      }
    >
      {modo === "programa" ? (
        <AuspiciosPorPrograma
          programa={filters.programa}
          meses={meses}
          singleMes={singleMes}
        />
      ) : (
        <AuspiciosPorMarca meses={meses} />
      )}
    </DashboardCard>
  );
}

function AuspiciosPorPrograma({
  programa,
  meses,
  singleMes,
}: {
  programa: string | undefined;
  meses: number[];
  singleMes: number | undefined;
}) {
  const hasPrograma = Boolean(programa);
  const query = useAuspicios({ programa, mes: singleMes }, hasPrograma);

  const datosEnRango = useMemo(() => {
    const data = query.data ?? [];
    if (meses.length <= 1) return data;
    return data.filter((auspicio) => meses.includes(auspicio.mes_num));
  }, [query.data, meses]);

  const contexto = singleMes
    ? `${programa} en ${MESES[singleMes - 1]}`
    : meses.length > 1
      ? `${programa} entre ${MESES[meses[0] - 1]} y ${MESES[meses[meses.length - 1] - 1]}`
      : `${programa}`;

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

  if (!hasPrograma) {
    return (
      <div className="flex flex-col gap-4">
        <InfoBanner>Elige un programa en los filtros para ver sus auspiciadores.</InfoBanner>
        <TopAuspiciadoresGlobal />
      </div>
    );
  }

  return (
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
  );
}

const TOP_AUSPICIADORES_LIMIT = 5;

/** Ranking global de auspiciadores (sin filtro de programa ni fecha, ver
 * /dashboard/auspicios/top) — se muestra mientras no se eligió un programa,
 * como contenido útil en vez de dejar el panel vacío con solo el aviso. */
function TopAuspiciadoresGlobal() {
  const query = useTopAuspiciadores(TOP_AUSPICIADORES_LIMIT);
  const items = query.data ?? [];

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        Top {TOP_AUSPICIADORES_LIMIT} auspiciadores globales
      </h4>
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isEmpty={items.length === 0}
        emptyMessage="No hay auspiciadores registrados."
        onRetry={query.refetch}
        loadingFallback={<Skeleton className="h-40 w-full" />}
      >
        <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
          {items.map((item, index) => (
            <li key={item.auspiciador} className="flex items-center justify-between gap-3 py-2">
              <span className="flex items-center gap-2.5 text-sm font-medium text-neutral-800 dark:text-neutral-100">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#b4975a] text-[11px] font-semibold text-[#0e0c09]">
                  {index + 1}
                </span>
                {item.auspiciador}
              </span>
              <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
                {item.cantidad_programas} programa{item.cantidad_programas === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      </QueryState>
    </div>
  );
}

function AuspiciosPorMarca({ meses }: { meses: number[] }) {
  const [qInput, setQInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(qInput.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [qInput]);

  const isQueryReady = debouncedQ.length >= MIN_QUERY_LENGTH;
  const query = useAuspiciosBusqueda(debouncedQ, isQueryReady);

  const datosEnRango = useMemo(() => {
    const data = query.data ?? [];
    if (meses.length === 0) return data;
    return data.filter((item) => meses.includes(item.mes_num));
  }, [query.data, meses]);

  const gruposPorMes = useMemo(() => {
    const porMes = new Map<number, { mesNombre: string; items: typeof datosEnRango }>();
    for (const item of datosEnRango) {
      const grupo = porMes.get(item.mes_num) ?? { mesNombre: item.mes_nombre, items: [] };
      grupo.items.push(item);
      porMes.set(item.mes_num, grupo);
    }
    return [...porMes.entries()].sort(([a], [b]) => a - b);
  }, [datosEnRango]);

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        value={qInput}
        onChange={(event) => setQInput(event.target.value)}
        placeholder="Buscar auspiciador (ej. BCP)…"
        className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900
          dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
      />

      {qInput.trim().length > 0 && qInput.trim().length < MIN_QUERY_LENGTH ? (
        <InfoBanner>Escribe al menos {MIN_QUERY_LENGTH} caracteres para buscar.</InfoBanner>
      ) : qInput.trim().length === 0 ? (
        <InfoBanner>Escribe el nombre (o parte del nombre) de una marca auspiciadora.</InfoBanner>
      ) : (
        <QueryState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          isEmpty={datosEnRango.length === 0}
          emptyMessage={`Ningún programa tiene a "${debouncedQ}" como auspiciador en el rango elegido.`}
          onRetry={query.refetch}
          loadingFallback={<Skeleton className="h-24 w-full" />}
        >
          <div className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
            {gruposPorMes.map(([mesNum, grupo]) => (
              <div key={mesNum} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <h4 className="flex items-baseline gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {grupo.mesNombre}
                  <span className="font-normal normal-case text-neutral-400 dark:text-neutral-500">
                    · {grupo.items.length} programa{grupo.items.length === 1 ? "" : "s"}
                  </span>
                </h4>
                <ul className={CHIP_LIST_CLASS}>
                  {grupo.items.map((item) => (
                    <li key={`${item.programa}-${item.auspiciador}`} className={CHIP_CLASS}>
                      {item.programa} · {item.canal}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </QueryState>
      )}
    </div>
  );
}
