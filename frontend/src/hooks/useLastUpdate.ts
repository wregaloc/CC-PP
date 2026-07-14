import { useQuery } from "@tanstack/react-query";

import { getSystemSummary } from "@/features/admin/api/adminSystemApi";

/** Fecha de la última actualización de datos exitosa — misma fuente que
 * Admin → Dashboard del Sistema → Actividad de datos (mismo `getSystemSummary`,
 * sin duplicar la lógica de qué carga cuenta como "exitosa"), consumida
 * también desde el Dashboard principal (FilterBar). `queryKey` propio
 * (no el de `useSystemSummary`) porque mezclar dos observers con distinto
 * `retry`/`refetchInterval` sobre la misma key da comportamiento
 * indefinido en TanStack Query — el costo es una request HTTP propia, no
 * lógica de negocio duplicada.
 *
 * El endpoint es admin-only: para roles Interno/Cliente la consulta falla
 * con 403 — `retry: false` evita reintentar un 403 (nunca va a cambiar) y
 * se resuelve como estado de error, no como excepción no manejada, para
 * que el consumidor pueda degradar a un mensaje de "no disponible" en vez
 * de romper el layout. */
export function useLastUpdate() {
  return useQuery({
    queryKey: ["dashboard", "last-update"],
    queryFn: getSystemSummary,
    refetchInterval: 30_000,
    retry: false,
    select: (data) => data.last_update_at,
  });
}
