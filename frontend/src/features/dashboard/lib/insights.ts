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
