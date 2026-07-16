import { useMemo } from "react";

import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useHorarioAudiencia } from "@/features/dashboard/hooks/useHorarioAudiencia";
import { formatCompactNumber } from "@/features/dashboard/lib/formatters";
import {
  colorIntensidad,
  construirGrillaHeatmap,
  esUnSoloDiaSeleccionado,
  esUnaSolaSemanaSeleccionada,
} from "@/features/dashboard/lib/horarioAudiencia";

const DISCLAIMER_CLASS = "py-6 text-center text-[13px] text-[#9a8f7a]";

function Disclaimer({ children }: { children: React.ReactNode }) {
  return <p className={DISCLAIMER_CLASS}>{children}</p>;
}

/**
 * Panel "Horario de Mayor Audiencia" — heatmap de vistas por día de semana ×
 * hora del día para el programa filtrado. Solo aplica con un programa
 * específico seleccionado (sin vista agregada de "Todos") y con el filtro de
 * fechas recortado a una única semana o día — reacciona a la granularidad
 * compartida con Evolutivo Detallado (ver DashboardFiltersContext).
 */
export function HorarioAudienciaPanel() {
  const { filters } = useDashboardFilters();

  if (!filters.programa) return null;

  return <HorarioAudienciaContent programa={filters.programa} />;
}

function HorarioAudienciaContent({ programa }: { programa: string }) {
  const {
    filters: { fecha_inicio, fecha_fin },
    granularidad,
    setGranularidad,
  } = useDashboardFilters();

  const semanaActiva = granularidad === "semana" && esUnaSolaSemanaSeleccionada(fecha_inicio, fecha_fin);
  const diaActivo = granularidad === "dia" && esUnSoloDiaSeleccionado(fecha_inicio, fecha_fin);
  const modo = semanaActiva ? "semana" : diaActivo ? "dia" : null;

  const query = useHorarioAudiencia(
    { programa, fecha_inicio, fecha_fin },
    modo !== null,
  );

  const grilla = useMemo(() => {
    if (!modo || !query.data) return null;
    return construirGrillaHeatmap(query.data, modo);
  }, [modo, query.data]);

  const maxVistas = useMemo(() => {
    if (!grilla) return 0;
    let max = 0;
    for (const fila of grilla) {
      for (const celda of fila) {
        if (celda.vistas !== null && celda.vistas > max) max = celda.vistas;
      }
    }
    return max;
  }, [grilla]);

  return (
    <DashboardCard title="Horario de Mayor Audiencia">
      <p className="text-xs text-[#9a8f7a]">
        {programa} — vistas por día y hora, periodo seleccionado
      </p>

      {granularidad === "anio" || granularidad === "mes" ? (
        <Disclaimer>
          El detalle de horario por día solo está disponible al filtrar por Semana o Día.
          Selecciona uno de esos rangos para ver este análisis.{" "}
          <button
            type="button"
            onClick={() => setGranularidad("semana")}
            className="font-medium text-[#b4975a] underline-offset-2 hover:underline"
          >
            Cambiar a Semana
          </button>
        </Disclaimer>
      ) : !modo ? (
        <Disclaimer>
          {granularidad === "semana"
            ? "Selecciona una sola semana (haz clic en una barra de Evolutivo Detallado) para ver este análisis."
            : "Selecciona un solo día (haz clic en una barra de Evolutivo Detallado) para ver este análisis."}
        </Disclaimer>
      ) : (
        <QueryState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          isEmpty={grilla !== null && maxVistas === 0}
          emptyMessage="No hay datos de horario para este programa en el periodo seleccionado."
          onRetry={query.refetch}
          loadingFallback={<Skeleton className="h-56 w-full" />}
        >
          {grilla && <HeatmapGrid grilla={grilla} maxVistas={maxVistas} />}
        </QueryState>
      )}
    </DashboardCard>
  );
}

const HORAS_ETIQUETA = new Set([0, 3, 6, 9, 12, 15, 18, 21]);

function HeatmapGrid({
  grilla,
  maxVistas,
}: {
  grilla: ReturnType<typeof construirGrillaHeatmap>;
  maxVistas: number;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="grid w-full gap-0.5" style={{ gridTemplateColumns: "2.25rem repeat(24, minmax(0, 1fr))" }}>
        <div />
        {Array.from({ length: 24 }, (_, hora) => (
          <div key={hora} className="text-center text-[9px] leading-none text-[#9a8f7a]">
            {HORAS_ETIQUETA.has(hora) ? `${hora}h` : ""}
          </div>
        ))}

        {grilla.map((fila) => (
          <FilaHeatmap key={fila[0].dia} fila={fila} maxVistas={maxVistas} />
        ))}
      </div>

      <Leyenda />
    </div>
  );
}

function FilaHeatmap({
  fila,
  maxVistas,
}: {
  fila: ReturnType<typeof construirGrillaHeatmap>[number];
  maxVistas: number;
}) {
  return (
    <>
      <div className="flex items-center text-xs font-medium text-[#c9bfa8]">{fila[0].dia}</div>
      {fila.map((celda) => {
        const ratio = maxVistas > 0 && celda.vistas !== null ? celda.vistas / maxVistas : 0;
        return (
          <div
            key={celda.hora}
            title={
              celda.vistas !== null
                ? `${fila[0].dia} ${celda.hora}h — ${formatCompactNumber(celda.vistas)} vistas`
                : `${fila[0].dia} ${celda.hora}h — sin datos`
            }
            className="h-4 rounded-sm"
            style={{ backgroundColor: colorIntensidad(ratio) }}
          />
        );
      })}
    </>
  );
}

function Leyenda() {
  const pasos = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1];
  return (
    <div className="mt-3 flex items-center gap-2 text-[11px] text-[#9a8f7a]">
      <span>Menos</span>
      <div className="flex gap-1">
        {pasos.map((ratio) => (
          <div
            key={ratio}
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: colorIntensidad(ratio) }}
          />
        ))}
      </div>
      <span>Más</span>
    </div>
  );
}
