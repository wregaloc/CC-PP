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

/** Fecha larga en español ("1 de mayo de 2026"), sin hora, a partir de un
 * ISO date ("YYYY-MM-DD") o datetime ("YYYY-MM-DDTHH:mm:ss...") — se arma a
 * mano con MESES en vez de Intl.DateTimeFormat porque el nombre del mes con
 * ese API depende del locale del navegador, y necesitamos que sea siempre
 * español sin importar la config del sistema. */
export function formatFechaLarga(iso: string | undefined | null): string | null {
  if (!iso) return null;
  const [anio, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  if (!anio || !mes || !dia) return null;
  return `${dia} de ${MESES[mes - 1].toLowerCase()} de ${anio}`;
}
