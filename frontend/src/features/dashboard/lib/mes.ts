export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** Deriva el mes (1-12) del campo "Desde" de la barra de filtros compartida
 * — varios widgets (Auspicios, Keywords) filtran por mes en vez de rango de
 * fecha, así que reusan este mismo criterio en lugar de agregar un selector
 * de mes propio en cada uno. */
export function mesFromFechaInicio(fechaInicio: string | undefined): number | undefined {
  if (!fechaInicio) return undefined;
  const mes = Number(fechaInicio.split("-")[1]);
  return Number.isInteger(mes) && mes >= 1 && mes <= 12 ? mes : undefined;
}
