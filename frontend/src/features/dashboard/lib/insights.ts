import { MESES } from "@/features/dashboard/lib/mes";

/** Fecha larga en español ("1 de mayo de 2026") para las frases del panel
 * Insights — se arma a mano con MESES en vez de Intl.DateTimeFormat porque
 * el nombre del mes con ese API depende del locale del navegador, y acá
 * necesitamos que sea siempre español sin importar la config del sistema. */
export function formatFechaLarga(iso: string | undefined): string | null {
  if (!iso) return null;
  const [anio, mes, dia] = iso.split("-").map(Number);
  if (!anio || !mes || !dia) return null;
  return `${dia} de ${MESES[mes - 1].toLowerCase()} de ${anio}`;
}

function parseFechaISO(iso: string): { anio: number; mes: number; dia: number } | null {
  const [anio, mes, dia] = iso.split("-").map(Number);
  if (!anio || !mes || !dia) return null;
  return { anio, mes, dia };
}

/** Frase de periodo compartida por los insights que citan el rango de
 * fechas activo (vistas+emisiones, sentimiento, franja horaria dominante):
 * - Mismo día (fechaInicio === fechaFin, p. ej. granularidad "Día"): "El 21
 *   de mayo de 2026" — decir "del 21 de mayo hasta el 21 de mayo" sería
 *   redundante.
 * - Mismo año, días distintos: "Durante el periodo del 4 de mayo hasta el
 *   10 de mayo de 2026" — omite el año de la primera fecha para no
 *   repetirlo dos veces seguidas.
 * - Años distintos: ambas fechas con su año completo.
 * - Sin alguna de las dos fechas: describe el periodo como histórico
 *   completo. */
export function formatPeriodoTexto(fechaInicio: string | undefined, fechaFin: string | undefined): string {
  const inicio = fechaInicio ? parseFechaISO(fechaInicio) : null;
  const fin = fechaFin ? parseFechaISO(fechaFin) : null;
  if (!inicio || !fin) return "Considerando todo el histórico disponible";

  if (fechaInicio === fechaFin) {
    return `El ${fin.dia} de ${MESES[fin.mes - 1].toLowerCase()} de ${fin.anio}`;
  }

  const inicioTexto =
    inicio.anio === fin.anio
      ? `${inicio.dia} de ${MESES[inicio.mes - 1].toLowerCase()}`
      : `${inicio.dia} de ${MESES[inicio.mes - 1].toLowerCase()} de ${inicio.anio}`;
  const finTexto = `${fin.dia} de ${MESES[fin.mes - 1].toLowerCase()} de ${fin.anio}`;

  return `Durante el periodo del ${inicioTexto} hasta el ${finTexto}`;
}

export interface EngagementClassification {
  label: string;
  rangeLabel: string;
}

/** Benchmarks de Engagement Rate de YouTube (Insight 2) — límite superior
 * exclusivo de cada categoría, en el mismo orden en que se evalúan. */
const ENGAGEMENT_BENCHMARKS: { max: number; label: string; rangeLabel: string }[] = [
  { max: 1, label: "Bajo", rangeLabel: "< 1%" },
  { max: 3, label: "Promedio", rangeLabel: "1–3%" },
  { max: 5, label: "Bueno", rangeLabel: "3–5%" },
  { max: 10, label: "Muy bueno", rangeLabel: "5–10%" },
  { max: Infinity, label: "Excepcional", rangeLabel: "> 10%" },
];

/** Clasifica un Engagement Rate en **porcentaje** (no fracción 0-1, ya
 * multiplicado por 100) contra los benchmarks de YouTube definidos. */
export function classifyEngagementRate(pct: number): EngagementClassification {
  const match = ENGAGEMENT_BENCHMARKS.find((bucket) => pct < bucket.max);
  return match ?? ENGAGEMENT_BENCHMARKS[ENGAGEMENT_BENCHMARKS.length - 1];
}
