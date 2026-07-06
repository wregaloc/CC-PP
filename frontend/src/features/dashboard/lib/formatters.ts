const NUMBER_FORMAT = new Intl.NumberFormat("es-PE");

export function formatCompactNumber(value: number): string {
  return NUMBER_FORMAT.format(Math.round(value));
}

export function formatPercent(fraction: number | null): string {
  if (fraction === null) return "—";
  return `${(fraction * 100).toFixed(1)} %`;
}
