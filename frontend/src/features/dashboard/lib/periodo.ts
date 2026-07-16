import type { Granularidad } from "@/features/dashboard/types";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Convierte el weekday de JS (domingo=0..sábado=6) al estilo Python usado
 * por el backend (lunes=0..domingo=6, ver week_num_excel_style). Exportada
 * porque el panel Horario de Mayor Audiencia también la necesita (agrupar
 * cada día del heatmap en su fila Lun..Dom). */
export function mondayFirstWeekday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * Convierte un `periodo` devuelto por /dashboard/evolutivo (formato según
 * granularidad) al rango [from, to] de fechas reales que representa — para
 * poder fijar `fecha_inicio`/`fecha_fin` al hacer clic en una barra del
 * Evolutivo Detallado (Doc-Migración §5.2) y filtrar el resto de la página
 * por ese período exacto.
 *
 * El caso "semana" replica exactamente `week_num_excel_style` del backend
 * (backend/app/etl/normalizers.py): semanas lunes-domingo, semana 1 = la
 * que contiene el 1 de enero — deliberadamente NO es la semana ISO 8601.
 */
export function rangoFromPeriodo(
  periodo: string,
  granularidad: Granularidad,
): { from: string; to: string } {
  switch (granularidad) {
    case "dia":
      return { from: periodo, to: periodo };

    case "mes": {
      const [anio, mes] = periodo.split("-").map(Number);
      const from = new Date(anio, mes - 1, 1);
      const to = new Date(anio, mes, 0); // día 0 del mes siguiente = último día del mes actual
      return { from: toISO(from), to: toISO(to) };
    }

    case "anio":
      return { from: `${periodo}-01-01`, to: `${periodo}-12-31` };

    case "semana": {
      const [anioStr, semanaStr] = periodo.split("-W");
      const anio = Number(anioStr);
      const semana = Number(semanaStr);
      const jan1 = new Date(anio, 0, 1);
      const jan1Weekday = mondayFirstWeekday(jan1);
      const startDays = 7 * (semana - 1) - jan1Weekday;
      const from = new Date(anio, 0, 1 + Math.max(0, startDays));
      const to = new Date(anio, 0, 1 + startDays + 6);
      return { from: toISO(from), to: toISO(to) };
    }
  }
}
