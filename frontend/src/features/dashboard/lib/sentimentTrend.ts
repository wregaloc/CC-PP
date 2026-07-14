import { MESES } from "@/features/dashboard/lib/mes";
import type { SentimentKpisResponse, SentimientoEvolutivoPoint } from "@/features/dashboard/types";

export type SentimentKey = "pct_positivo" | "pct_negativo" | "pct_neutral";

/** Variación MoM en puntos porcentuales: último punto de la serie vs. el
 * penúltimo (mes más reciente vs. el anterior) — no confundir con variación
 * porcentual relativa, ya estamos comparando dos porcentajes entre sí.
 * Compartido por SentimentKpiCards (indicador ▲/▼) e InsightsPanel
 * (Insight 3, tendencia del sentimiento predominante). */
export function computeMomDeltaPuntos(
  data: SentimientoEvolutivoPoint[] | undefined,
  key: SentimentKey,
): number | null {
  if (!data || data.length < 2) return null;
  const last = data[data.length - 1][key];
  const previous = data[data.length - 2][key];
  if (last === null || previous === null) return null;
  return (last - previous) * 100;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export interface MomRange {
  fecha_inicio: string;
  fecha_fin: string;
}

/** Rango [1º del mes anterior al de referencia, fin del mes de referencia] —
 * garantiza 2 puntos (mes anterior + mes de referencia) para una comparación
 * MoM sin importar cuán angosto sea el rango de fechas que eligió el usuario
 * (p. ej. filtrar un solo mes no debe dejar la comparación sin datos). */
export function computeMomRange(referenceIso: string | undefined): MomRange | null {
  if (!referenceIso) return null;
  const reference = parseISODate(referenceIso);
  const priorMonthStart = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  const referenceMonthEnd = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  return { fecha_inicio: toISODate(priorMonthStart), fecha_fin: toISODate(referenceMonthEnd) };
}

/** "mes de referencia vs. mes anterior" en español, p. ej. "mayo vs. abril"
 * — para nombrar explícitamente qué dos meses se están comparando en el
 * Insight 3 (sin esto, un "+7.2 p.p." suelto se puede confundir con la
 * variación de todo el rango filtrado, que es un número distinto).
 *
 * Se deriva del campo `mes` ("YYYY-MM") de los dos últimos puntos de la
 * propia serie, no del `MomRange` sintético — así funciona igual sin
 * filtro de fecha (donde no hay un `MomRange` que nombrar, pero la serie
 * sigue trayendo los últimos 2 meses con datos reales). */
export function describeMomMonths(data: SentimientoEvolutivoPoint[] | undefined): string | null {
  if (!data || data.length < 2) return null;
  const monthName = (mesStr: string): string => {
    const monthIndex = Number(mesStr.split("-")[1]) - 1;
    return MESES[monthIndex]?.toLowerCase() ?? mesStr;
  };
  return `${monthName(data[data.length - 1].mes)} vs. ${monthName(data[data.length - 2].mes)}`;
}

export interface DominantSentiment {
  key: SentimentKey;
  label: string;
  valuePct: number;
}

const SENTIMENT_LABEL: Record<SentimentKey, string> = {
  pct_positivo: "Positivo",
  pct_negativo: "Negativo",
  pct_neutral: "Neutral",
};

/** El sentimiento con mayor % dentro del rango filtrado (Insight 3) — `null`
 * si las tres categorías vienen sin datos (sin filas de fact_sentimiento
 * para ese programa/período). Un empate exacto se resuelve tomando el
 * primero encontrado (positivo > negativo > neutral), sin lógica especial. */
export function getDominantSentiment(kpis: SentimentKpisResponse): DominantSentiment | null {
  const candidates: { key: SentimentKey; value: number | null }[] = [
    { key: "pct_positivo", value: kpis.pct_positivo },
    { key: "pct_negativo", value: kpis.pct_negativo },
    { key: "pct_neutral", value: kpis.pct_neutral },
  ];
  const withValue = candidates.filter(
    (c): c is { key: SentimentKey; value: number } => c.value !== null,
  );
  if (withValue.length === 0) return null;

  const top = withValue.reduce((a, b) => (b.value > a.value ? b : a));
  return { key: top.key, label: SENTIMENT_LABEL[top.key], valuePct: top.value * 100 };
}

/** Verbo de tendencia para el Insight 3. Positivo/Negativo tienen una
 * dirección "buena" (igual criterio que el color del indicador MoM: para
 * Negativo, bajar es la buena noticia) — Neutral no, así que usa un verbo
 * sin juicio de valor. */
export function describeSentimentTrend(key: SentimentKey, deltaPuntos: number): string {
  const rounded = Math.round(deltaPuntos * 10) / 10;
  if (rounded === 0) return "se mantuvo estable";

  if (key === "pct_neutral") {
    return rounded > 0 ? "subió" : "bajó";
  }
  const isFavorable = key === "pct_positivo" ? rounded > 0 : rounded < 0;
  return isFavorable ? "mejoró" : "empeoró";
}
