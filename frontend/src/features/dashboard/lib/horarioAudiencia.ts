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

const DIA_COMPLETO: Record<string, string> = {
  Lun: "Lunes",
  Mar: "Martes",
  Mié: "Miércoles",
  Jue: "Jueves",
  Vie: "Viernes",
  Sáb: "Sábado",
  Dom: "Domingo",
};

/** Nombre completo del día de semana ("Lunes") a partir de una fecha ISO —
 * usado como etiqueta de fila del heatmap en modo "día" (antes mostraba la
 * fecha ISO cruda, p. ej. "2026-06-12", que no dice qué día de la semana
 * es a simple vista). Si la fecha viene vacía o inválida, devuelve la
 * entrada tal cual en vez de "undefined" en pantalla. */
function diaCompletoDesdeFecha(fechaISO: string): string {
  if (!fechaISO) return fechaISO;
  const abreviatura = DIAS_SEMANA[mondayFirstWeekday(parseISODate(fechaISO))];
  return abreviatura ? DIA_COMPLETO[abreviatura] : fechaISO;
}

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
 * y se omite del heatmap en vez de adivinar la hora.
 *
 * `fechaDia` (modo "día") es la fecha seleccionada en el filtro, no la del
 * primer punto de datos — así la fila sigue mostrando el día correcto
 * ("Viernes") aunque ese día no tenga ningún dato todavía. */
export function construirGrillaHeatmap(
  puntos: HorarioAudienciaPoint[],
  modo: "semana" | "dia",
  fechaDia?: string,
): CeldaHeatmap[][] {
  const dias =
    modo === "dia" ? [diaCompletoDesdeFecha(fechaDia ?? puntos[0]?.fecha ?? "")] : DIAS_SEMANA;
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

/** Traduce la abreviatura de día usada en la grilla (Lun/Mar/...) al nombre
 * completo para el insight "franja horaria dominante" (ver InsightsPanel) —
 * en modo "dia" la grilla es un solo día (sin variación de día de semana
 * dentro del heatmap), así que nombrarlo no aporta nada: devuelve `null` y
 * el llamador omite esa parte de la frase. */
export function formatDiaBloque(dia: string, modo: "semana" | "dia"): string | null {
  if (modo === "dia") return null;
  return DIA_COMPLETO[dia] ?? dia;
}

export interface BloqueMax {
  dia: string;
  hora: number;
  vistas: number;
}

/** Encuentra la celda con más vistas de una grilla ya construida por
 * `construirGrillaHeatmap` — usado por el insight "franja horaria
 * dominante" (ver InsightsPanel) para leer el mismo dato que pinta el
 * heatmap, en vez de recalcularlo por su cuenta. */
export function encontrarBloqueMax(grilla: CeldaHeatmap[][]): BloqueMax | null {
  let mejor: BloqueMax | null = null;
  for (const fila of grilla) {
    for (const celda of fila) {
      if (celda.vistas !== null && (mejor === null || celda.vistas > mejor.vistas)) {
        mejor = { dia: celda.dia, hora: celda.hora, vistas: celda.vistas };
      }
    }
  }
  return mejor;
}

export interface BloqueMaxCanal extends BloqueMax {
  programa: string;
}

/** Igual que `encontrarBloqueMax` pero para la grilla combinada del modo
 * "canal" (`construirGrillaHeatmapCanal`) — cada celda ya sabe qué programa
 * la domina, así que el insight puede citarlo directamente sin un segundo
 * cálculo. */
export function encontrarBloqueMaxCanal(grilla: CeldaCanalHeatmap[][]): BloqueMaxCanal | null {
  let mejor: BloqueMaxCanal | null = null;
  for (const fila of grilla) {
    for (const celda of fila) {
      if (celda.programa !== null && celda.vistas !== null && (mejor === null || celda.vistas > mejor.vistas)) {
        mejor = { dia: celda.dia, hora: celda.hora, vistas: celda.vistas, programa: celda.programa };
      }
    }
  }
  return mejor;
}

/** Interpola entre el carbón oscuro y el oro claro de la paleta del
 * dashboard según `ratio` (0-1) — mismo criterio de color que el resto de
 * los paneles (rgba(180,151,90,...)), pero como degradado continuo en vez
 * de un acento fijo, para representar intensidad en el heatmap. */
export function colorIntensidad(ratio: number): string {
  return colorIntensidadDesde(0x2a, 0x25, 0x1b, 0xe8, 0xd9, 0xb0, ratio);
}

function colorIntensidadDesde(
  r0: number, g0: number, b0: number,
  r1: number, g1: number, b1: number,
  ratio: number,
): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  const r = Math.round(r0 + (r1 - r0) * clamped);
  const g = Math.round(g0 + (g1 - g0) * clamped);
  const b = Math.round(b0 + (b1 - b0) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Paleta categórica para diferenciar programas dentro de un mismo heatmap
 * (modo "canal") — rampa dorada/bronce monocromática (marfil → oro → cobre
 * → bronce → chocolate) elegida para que las celdas se sientan parte del
 * mismo look and feel del dashboard, en vez de una paleta multi-hue. Como
 * una rampa de un solo hue separa peor bajo daltonismo que una paleta con
 * hues distintos, la diferenciación real de "qué programa es cuál" se
 * apoya en la leyenda (nombre + swatch, siempre visible) y en el número de
 * vistas escrito en cada celda — no solo en el color. Dos tonos (#4, #8)
 * son oscuros y quedan con bajo contraste contra el carbón del panel;
 * `textoParaPrograma` compensa usando texto claro sobre esas celdas para
 * que al menos la cifra siga siendo legible. */
const PALETA_PROGRAMAS: readonly [number, number, number][] = [
  [0xf5, 0xf1, 0xe8], // marfil
  [0x8a, 0x6f, 0x3c], // oro profundo/bronce
  [0xd8, 0xbc, 0x82], // oro claro
  [0x5c, 0x4a, 0x2e], // bronce muy oscuro
  [0xa6, 0x7c, 0x52], // cobre/terracota
  [0xa8, 0x94, 0x78], // gris-bronce apagado
  [0xe8, 0xc9, 0x5e], // ámbar dorado
  [0x6b, 0x4a, 0x3a], // marrón chocolate oscuro
];

/** Por color de la paleta, qué tinta de texto (clara u oscura) da mejor
 * contraste para la cifra escrita encima — la mayoría de la rampa es clara
 * y usa la tinta oscura del resto del dashboard, pero los tonos más
 * oscuros de la rampa (bronce muy oscuro, chocolate, y oro profundo en
 * menor medida) necesitan texto claro para seguir siendo legibles. */
const TEXTO_CLARO_POR_COLOR: readonly boolean[] = [false, true, false, true, false, false, false, true];
const TEXTO_OSCURO = "#241f16";
const TEXTO_CLARO = "#f5ede0";

export function textoParaPrograma(colorIndex: number): string {
  return TEXTO_CLARO_POR_COLOR[colorIndex % TEXTO_CLARO_POR_COLOR.length] ? TEXTO_CLARO : TEXTO_OSCURO;
}

/** Interpola entre el carbón oscuro y el color base asignado a un programa
 * — mismo criterio que `colorIntensidad`, pero con un hue por programa en
 * vez de un único degradado, para el heatmap combinado del modo "canal". */
export function colorIntensidadPrograma(colorIndex: number, ratio: number): string {
  const [r1, g1, b1] = PALETA_PROGRAMAS[colorIndex % PALETA_PROGRAMAS.length];
  return colorIntensidadDesde(0x2a, 0x25, 0x1b, r1, g1, b1, ratio);
}

export interface CeldaCanalHeatmap {
  dia: string;
  hora: number;
  programa: string | null;
  vistas: number | null;
  colorIndex: number | null;
}

export interface ProgramaLeyenda {
  programa: string;
  colorIndex: number;
  totalVistas: number;
}

export interface GrillaCanalHeatmap {
  grilla: CeldaCanalHeatmap[][];
  leyenda: ProgramaLeyenda[];
  tieneCeldasConDatos: boolean;
}

/** Modo "canal": arma UN solo heatmap con las filas de todos los programas
 * del canal mezcladas (ver `programa` en cada HorarioAudienciaPoint) —
 * cada celda se colorea con el hue plano del programa dominante en ese
 * (día, hora) según `PALETA_PROGRAMAS` (color plano, no degradado: la
 * magnitud se lee del número de vistas escrito en la celda, no de la
 * intensidad del color). La leyenda se ordena por vistas totales del
 * período, y ese orden decide qué color de la paleta le toca a cada
 * programa (el más visto se lleva el primero). Si dos programas cayeran en
 * la misma celda (mismo día y misma hora dominante), gana el de más vistas
 * ese día — un empate real es un caso borde aceptado, no se apilan ambos
 * en una sola celda. */
export function construirGrillaHeatmapCanal(
  puntos: HorarioAudienciaPoint[],
  modo: "semana" | "dia",
  fechaDia?: string,
): GrillaCanalHeatmap {
  const dias =
    modo === "dia" ? [diaCompletoDesdeFecha(fechaDia ?? puntos[0]?.fecha ?? "")] : DIAS_SEMANA;
  const grilla: CeldaCanalHeatmap[][] = dias.map((dia) =>
    Array.from({ length: 24 }, (_, hora) => ({ dia, hora, programa: null, vistas: null, colorIndex: null })),
  );

  // El orden de la leyenda (y por lo tanto qué color de la paleta le toca a
  // cada programa) se decide antes de llenar la grilla, para poder guardar
  // el colorIndex directamente en cada celda en un solo recorrido.
  const totalPorPrograma = new Map<string, number>();
  for (const punto of puntos) {
    totalPorPrograma.set(punto.programa, (totalPorPrograma.get(punto.programa) ?? 0) + punto.vistas_diarias);
  }
  const leyenda: ProgramaLeyenda[] = [...totalPorPrograma.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([programa, totalVistas], colorIndex) => ({ programa, totalVistas, colorIndex }));
  const colorIndexPorPrograma = new Map(leyenda.map((item) => [item.programa, item.colorIndex]));

  for (const punto of puntos) {
    if (!punto.hora_transmision) continue;
    const hora = Number(punto.hora_transmision.split(":")[0]);
    if (!Number.isInteger(hora) || hora < 0 || hora > 23) continue;

    const filaIndex = modo === "dia" ? 0 : mondayFirstWeekday(parseISODate(punto.fecha));
    const fila = grilla[filaIndex];
    if (!fila) continue;
    const celdaActual = fila[hora];
    if (celdaActual.vistas === null || punto.vistas_diarias > celdaActual.vistas) {
      fila[hora] = {
        dia: celdaActual.dia,
        hora,
        programa: punto.programa,
        vistas: punto.vistas_diarias,
        colorIndex: colorIndexPorPrograma.get(punto.programa) ?? 0,
      };
    }
  }

  const tieneCeldasConDatos = grilla.some((fila) => fila.some((celda) => celda.programa !== null));

  return { grilla, leyenda, tieneCeldasConDatos };
}
