import { mondayFirstWeekday } from "@/features/dashboard/lib/periodo";
import type { HorarioAudienciaPoint } from "@/features/dashboard/types";

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function diffEnDias(desde: string, hasta: string): number {
  const MS_POR_DIA = 24 * 60 * 60 * 1000;
  return Math.round((parseISODate(hasta).getTime() - parseISODate(desde).getTime()) / MS_POR_DIA);
}

/** El panel Horario de Mayor Audiencia solo se activa cuando el usuario ya
 * recortó el filtro a una única semana calendario (p. ej. haciendo clic en
 * una barra de "Semana" en Evolutivo Detallado, que fija fecha_inicio/fin a
 * ese rango exacto de 7 días vía rangoFromPeriodo) — un rango de fechas
 * amplio con granularidad "semana" activa NO alcanza. */
export function esUnaSolaSemanaSeleccionada(
  fechaInicio: string | undefined,
  fechaFin: string | undefined,
): boolean {
  if (!fechaInicio || !fechaFin) return false;
  return diffEnDias(fechaInicio, fechaFin) === 6;
}

/** Mismo criterio que arriba pero para granularidad "Día": el filtro debe
 * estar recortado a un único día (fecha_inicio === fecha_fin). */
export function esUnSoloDiaSeleccionado(
  fechaInicio: string | undefined,
  fechaFin: string | undefined,
): boolean {
  if (!fechaInicio || !fechaFin) return false;
  return fechaInicio === fechaFin;
}

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export interface CeldaHeatmap {
  dia: string;
  hora: number;
  vistas: number | null;
}

/** Arma la grilla completa (diasEnGrid × 24 horas) en blanco (vistas=null)
 * y la rellena con los puntos recibidos — cada punto de fact_audiencia trae
 * la hora del video de más vistas de ESE día (no una distribución horaria
 * real), así que cada día contribuye a lo sumo a una sola celda; un día sin
 * `hora_transmision` (dato no disponible para esa carga) no puede ubicarse
 * y se omite del heatmap en vez de adivinar la hora. */
export function construirGrillaHeatmap(
  puntos: HorarioAudienciaPoint[],
  modo: "semana" | "dia",
): CeldaHeatmap[][] {
  const dias = modo === "dia" ? [puntos[0]?.fecha ?? ""] : DIAS_SEMANA;
  const grilla: CeldaHeatmap[][] = dias.map((dia) =>
    Array.from({ length: 24 }, (_, hora) => ({ dia, hora, vistas: null })),
  );

  for (const punto of puntos) {
    if (!punto.hora_transmision) continue;
    const hora = Number(punto.hora_transmision.split(":")[0]);
    if (!Number.isInteger(hora) || hora < 0 || hora > 23) continue;

    const filaIndex = modo === "dia" ? 0 : mondayFirstWeekday(parseISODate(punto.fecha));
    const fila = grilla[filaIndex];
    if (!fila) continue;
    fila[hora] = { ...fila[hora], vistas: (fila[hora].vistas ?? 0) + punto.vistas_diarias };
  }

  return grilla;
}

/** Interpola entre el carbón oscuro y el oro claro de la paleta del
 * dashboard según `ratio` (0-1) — mismo criterio de color que el resto de
 * los paneles (rgba(180,151,90,...)), pero como degradado continuo en vez
 * de un acento fijo, para representar intensidad en el heatmap. */
export function colorIntensidad(ratio: number): string {
  const r0 = 0x2a, g0 = 0x25, b0 = 0x1b; // carbón oscuro (sin datos / mínimo)
  const r1 = 0xe8, g1 = 0xd9, b1 = 0xb0; // oro claro (máximo)
  const clamped = Math.max(0, Math.min(1, ratio));
  const r = Math.round(r0 + (r1 - r0) * clamped);
  const g = Math.round(g0 + (g1 - g0) * clamped);
  const b = Math.round(b0 + (b1 - b0) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}
