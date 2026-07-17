import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { esUnSoloDiaSeleccionado, esUnaSolaSemanaSeleccionada } from "@/features/dashboard/lib/horarioAudiencia";
import type { Granularidad, ProgramType } from "@/features/dashboard/types";

/** Condición de visibilidad del heatmap "Horario de Mayor Audiencia" — el
 * filtro de fechas debe estar recortado a una sola semana o un solo día
 * (ver esUnaSolaSemanaSeleccionada/esUnSoloDiaSeleccionado), reaccionando a
 * la granularidad compartida con Evolutivo Detallado (ver
 * DashboardFiltersContext). Vive en un hook propio (no local a
 * HorarioAudienciaPanel) porque InsightsPanel necesita exactamente el
 * mismo cálculo de `modo` para decidir cuándo mostrar el insight de franja
 * horaria dominante — nunca un cálculo separado que pudiera
 * desincronizarse de lo que el heatmap realmente muestra. */
export function useHorarioModo(): {
  fecha_inicio: string | undefined;
  fecha_fin: string | undefined;
  tipo: ProgramType | undefined;
  granularidad: Granularidad;
  setGranularidad: (value: Granularidad) => void;
  modo: "semana" | "dia" | null;
} {
  const {
    filters: { fecha_inicio, fecha_fin, tipo },
    granularidad,
    setGranularidad,
  } = useDashboardFilters();

  const semanaActiva = granularidad === "semana" && esUnaSolaSemanaSeleccionada(fecha_inicio, fecha_fin);
  const diaActivo = granularidad === "dia" && esUnSoloDiaSeleccionado(fecha_inicio, fecha_fin);
  const modo = semanaActiva ? "semana" : diaActivo ? "dia" : null;

  return { fecha_inicio, fecha_fin, tipo, granularidad, setGranularidad, modo };
}
