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

/** Lista de meses (1-12, sin duplicados) cubiertos por el rango
 * "Desde"/"Hasta" del date picker — p. ej. abril-mayo devuelve [4, 5]. Un
 * panel puede usar esto para filtrar/agrupar por *todos* los meses
 * seleccionados, no solo el primero (ver AuspiciosPanel). Sin `fechaInicio`
 * devuelve [] (sin filtro de mes = todo el histórico). */
export function mesesFromRango(fechaInicio: string | undefined, fechaFin: string | undefined): number[] {
  if (!fechaInicio) return [];
  const inicio = new Date(`${fechaInicio}T00:00:00`);
  const fin = fechaFin ? new Date(`${fechaFin}T00:00:00`) : inicio;
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return [];

  const meses = new Set<number>();
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const limite = new Date(fin.getFullYear(), fin.getMonth(), 1);
  let guard = 0;
  while (cursor <= limite && guard < 60) {
    meses.add(cursor.getMonth() + 1);
    cursor.setMonth(cursor.getMonth() + 1);
    guard++;
  }
  return [...meses];
}
