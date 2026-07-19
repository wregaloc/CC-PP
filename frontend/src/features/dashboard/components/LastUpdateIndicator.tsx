import { formatFechaLarga } from "@/lib/formatDate";
import { useLastUpdate } from "@/hooks/useLastUpdate";

/** "Data hasta el {fecha}" (solo fecha, sin hora) en la esquina superior
 * derecha del FilterBar. Mientras carga no muestra nada (evita un parpadeo
 * de "no disponible" antes de tener respuesta); si la consulta falla o no
 * hay fecha, cae a un texto de fallback en vez de dejar el espacio vacío. */
export function LastUpdateIndicator() {
  const { data: lastUpdateAt, isPending, isError } = useLastUpdate();

  if (isPending) return null;

  const fecha = !isError ? formatFechaLarga(lastUpdateAt) : null;
  const label = fecha ? `Data hasta el ${fecha}` : "Actualización no disponible";

  return <span className="text-[11px] text-[#9a8f7a]">{label}</span>;
}
