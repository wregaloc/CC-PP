import { useMemo, type ReactNode } from "react";

import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useHorarioAudiencia } from "@/features/dashboard/hooks/useHorarioAudiencia";
import { formatCompactNumber, formatVistasCorto } from "@/features/dashboard/lib/formatters";
import {
  colorIntensidad,
  colorIntensidadPrograma,
  construirGrillaHeatmap,
  construirGrillaHeatmapCanal,
  esUnSoloDiaSeleccionado,
  esUnaSolaSemanaSeleccionada,
  textoParaPrograma,
} from "@/features/dashboard/lib/horarioAudiencia";
import type { Granularidad } from "@/features/dashboard/types";

const DISCLAIMER_CLASS = "py-6 text-center text-[13px] text-[#9a8f7a]";

function Disclaimer({ children }: { children: ReactNode }) {
  return <p className={DISCLAIMER_CLASS}>{children}</p>;
}

/** Condición de visibilidad compartida por el modo "programa" y el modo
 * "canal": el filtro de fechas debe estar recortado a una sola semana o un
 * solo día (ver esUnaSolaSemanaSeleccionada/esUnSoloDiaSeleccionado) —
 * reacciona a la granularidad compartida con Evolutivo Detallado (ver
 * DashboardFiltersContext). */
function useHorarioModo(): {
  fecha_inicio: string | undefined;
  fecha_fin: string | undefined;
  granularidad: Granularidad;
  setGranularidad: (value: Granularidad) => void;
  modo: "semana" | "dia" | null;
} {
  const {
    filters: { fecha_inicio, fecha_fin },
    granularidad,
    setGranularidad,
  } = useDashboardFilters();

  const semanaActiva = granularidad === "semana" && esUnaSolaSemanaSeleccionada(fecha_inicio, fecha_fin);
  const diaActivo = granularidad === "dia" && esUnSoloDiaSeleccionado(fecha_inicio, fecha_fin);
  const modo = semanaActiva ? "semana" : diaActivo ? "dia" : null;

  return { fecha_inicio, fecha_fin, granularidad, setGranularidad, modo };
}

function GranularidadDisclaimer({
  granularidad,
  modo,
  setGranularidad,
}: {
  granularidad: Granularidad;
  modo: "semana" | "dia" | null;
  setGranularidad: (value: Granularidad) => void;
}) {
  if (granularidad === "anio" || granularidad === "mes") {
    return (
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
    );
  }
  if (!modo) {
    return (
      <Disclaimer>
        {granularidad === "semana"
          ? "Selecciona una sola semana (haz clic en una barra de Evolutivo Detallado) para ver este análisis."
          : "Selecciona un solo día (haz clic en una barra de Evolutivo Detallado) para ver este análisis."}
      </Disclaimer>
    );
  }
  return null;
}

/**
 * Panel "Horario de Mayor Audiencia" — heatmap de vistas por día de semana ×
 * hora del día. Con un programa específico filtrado muestra un único
 * heatmap; con solo un canal filtrado (sin programa puntual) muestra un
 * único heatmap combinado con los horarios de todos los programas del
 * canal, cada uno diferenciado por color (ver PALETA_PROGRAMAS en
 * lib/horarioAudiencia). Sin programa ni canal no hay vista agregada
 * posible.
 */
export function HorarioAudienciaPanel() {
  const { filters } = useDashboardFilters();

  if (filters.programa) return <HorarioAudienciaContent programa={filters.programa} />;
  if (filters.canal) return <HorarioAudienciaPorCanalContent canal={filters.canal} />;
  return null;
}

function HorarioAudienciaContent({ programa }: { programa: string }) {
  const { fecha_inicio, fecha_fin, granularidad, setGranularidad, modo } = useHorarioModo();

  const query = useHorarioAudiencia({ programa, fecha_inicio, fecha_fin }, modo !== null);

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

      <GranularidadDisclaimer granularidad={granularidad} modo={modo} setGranularidad={setGranularidad} />

      {modo && (
        <QueryState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          isEmpty={grilla !== null && maxVistas === 0}
          emptyMessage="No hay datos de horario para este programa en el periodo seleccionado."
          onRetry={query.refetch}
          loadingFallback={<Skeleton className="h-56 w-full" />}
        >
          {grilla && (
            <div className="overflow-x-auto">
              <HeatmapGrid grilla={grilla} maxVistas={maxVistas} />
              <Leyenda />
            </div>
          )}
        </QueryState>
      )}
    </DashboardCard>
  );
}

function HorarioAudienciaPorCanalContent({ canal }: { canal: string }) {
  const { fecha_inicio, fecha_fin, granularidad, setGranularidad, modo } = useHorarioModo();

  const query = useHorarioAudiencia({ canal, fecha_inicio, fecha_fin }, modo !== null);

  const resultado = useMemo(() => {
    if (!modo || !query.data) return null;
    return construirGrillaHeatmapCanal(query.data, modo);
  }, [modo, query.data]);

  return (
    <DashboardCard title="Horario de Mayor Audiencia">
      <p className="text-xs text-[#9a8f7a]">
        {canal} — vistas por día y hora, cada programa diferenciado por color
      </p>

      <GranularidadDisclaimer granularidad={granularidad} modo={modo} setGranularidad={setGranularidad} />

      {modo && (
        <QueryState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          isEmpty={resultado !== null && !resultado.tieneCeldasConDatos}
          emptyMessage="No hay datos de horario para los programas de este canal en el periodo seleccionado."
          onRetry={query.refetch}
          loadingFallback={<Skeleton className="h-56 w-full" />}
        >
          {resultado && (
            <div className="overflow-x-auto">
              <HeatmapGridCanal grilla={resultado.grilla} />
              <LeyendaProgramas leyenda={resultado.leyenda} />
            </div>
          )}
        </QueryState>
      )}
    </DashboardCard>
  );
}

const HORAS_ETIQUETA = new Set([0, 3, 6, 9, 12, 15, 18, 21]);

/** Grilla día×hora del modo "programa" (un solo hue, degradado de
 * intensidad) — ver HeatmapGridCanal para el modo "canal" (varios
 * programas, un color por programa). */
function HeatmapGrid({
  grilla,
  maxVistas,
}: {
  grilla: ReturnType<typeof construirGrillaHeatmap>;
  maxVistas: number;
}) {
  return (
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

/** Grilla día×hora del modo "canal" — cada celda con dato toma el color
 * plano del programa dominante en ese (día, hora) y muestra su cifra de
 * vistas como etiqueta (la magnitud se lee del número, no de la
 * intensidad del color — por eso las celdas son más altas que en el modo
 * "programa", para que el texto entre). */
function HeatmapGridCanal({ grilla }: { grilla: ReturnType<typeof construirGrillaHeatmapCanal>["grilla"] }) {
  return (
    <div className="grid w-full gap-0.5" style={{ gridTemplateColumns: "2.25rem repeat(24, minmax(0, 1fr))" }}>
      <div />
      {Array.from({ length: 24 }, (_, hora) => (
        <div key={hora} className="text-center text-[9px] leading-none text-[#9a8f7a]">
          {HORAS_ETIQUETA.has(hora) ? `${hora}h` : ""}
        </div>
      ))}

      {grilla.map((fila) => (
        <FilaHeatmapCanal key={fila[0].dia} fila={fila} />
      ))}
    </div>
  );
}

function FilaHeatmapCanal({ fila }: { fila: ReturnType<typeof construirGrillaHeatmapCanal>["grilla"][number] }) {
  return (
    <>
      <div className="flex items-center text-xs font-medium text-[#c9bfa8]">{fila[0].dia}</div>
      {fila.map((celda) => {
        if (!celda.programa || celda.vistas === null || celda.colorIndex === null) {
          return (
            <div
              key={celda.hora}
              title={`${fila[0].dia} ${celda.hora}h — sin datos`}
              className="h-6 rounded-sm"
              style={{ backgroundColor: colorIntensidad(0) }}
            />
          );
        }
        return (
          <div
            key={celda.hora}
            title={`${fila[0].dia} ${celda.hora}h — ${celda.programa}: ${formatCompactNumber(celda.vistas)} vistas`}
            className="flex h-6 items-center justify-center rounded-sm text-[10px] font-semibold"
            style={{
              backgroundColor: colorIntensidadPrograma(celda.colorIndex, 1),
              color: textoParaPrograma(celda.colorIndex),
            }}
          >
            {formatVistasCorto(celda.vistas)}
          </div>
        );
      })}
    </>
  );
}

function LeyendaProgramas({ leyenda }: { leyenda: ReturnType<typeof construirGrillaHeatmapCanal>["leyenda"] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[#9a8f7a]">
      {leyenda.map((item) => (
        <span key={item.programa} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: colorIntensidadPrograma(item.colorIndex, 1) }}
          />
          {item.programa}
          <span className="text-[#7d735f]">({formatCompactNumber(item.totalVistas)})</span>
        </span>
      ))}
    </div>
  );
}
