import { useQuery } from "@tanstack/react-query";

import { getHorarioAudiencia } from "@/features/dashboard/api/dashboardApi";
import type { DashboardFilters } from "@/features/dashboard/types";

export function useHorarioAudiencia(
  params: Pick<DashboardFilters, "fecha_inicio" | "fecha_fin"> &
    ({ programa: string; canal?: undefined } | { canal: string; programa?: undefined }),
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["dashboard", "horario-audiencia", params],
    queryFn: () => getHorarioAudiencia(params),
    enabled,
  });
}
