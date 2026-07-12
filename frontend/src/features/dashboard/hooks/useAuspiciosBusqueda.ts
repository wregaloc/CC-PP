import { useQuery } from "@tanstack/react-query";

import { getAuspiciosBusqueda } from "@/features/dashboard/api/dashboardApi";

export function useAuspiciosBusqueda(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ["dashboard", "auspicios-busqueda", q],
    queryFn: () => getAuspiciosBusqueda(q),
    enabled,
  });
}
