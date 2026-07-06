import { useQuery } from "@tanstack/react-query";

import { getEvolutivo } from "@/features/dashboard/api/dashboardApi";
import type {
  DashboardFilters,
  Granularidad,
  MetricaSecundaria,
} from "@/features/dashboard/types";

export function useEvolutivo(
  filters: DashboardFilters & { granularidad: Granularidad; metrica_secundaria: MetricaSecundaria },
) {
  return useQuery({
    queryKey: ["dashboard", "evolutivo", filters],
    queryFn: () => getEvolutivo(filters),
  });
}
