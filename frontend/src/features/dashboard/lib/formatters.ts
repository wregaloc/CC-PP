const NUMBER_FORMAT = new Intl.NumberFormat("es-PE");

export function formatCompactNumber(value: number): string {
  return NUMBER_FORMAT.format(Math.round(value));
}

export function formatPercent(fraction: number | null): string {
  if (fraction === null) return "—";
  return `${(fraction * 100).toFixed(1)} %`;
}

/** Notación corta sin decimales (12k, 2M) para etiquetas dentro de espacios
 * chicos (p. ej. las celdas del heatmap "Horario de Mayor Audiencia") — a
 * diferencia de `formatCompactNumber`, que solo agrega separador de miles. */
export function formatVistasCorto(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}
