import { useQuery } from "@tanstack/react-query";

import { getSentimientoEvolutivo } from "@/features/dashboard/api/dashboardApi";
import type { DashboardFilters } from "@/features/dashboard/types";

export function useSentimientoEvolutivo(
  filters: Pick<DashboardFilters, "fecha_inicio" | "fecha_fin" | "programa">,
) {
  return useQuery({
    queryKey: ["dashboard", "sentimiento-evolutivo", filters],
    queryFn: () => getSentimientoEvolutivo(filters),
  });
}
