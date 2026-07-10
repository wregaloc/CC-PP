import { useQuery } from "@tanstack/react-query";

import { getCanalProgramas } from "@/features/dashboard/api/dashboardApi";

export function useCanalProgramas(
  canalId: string | undefined,
  params: { fecha_inicio?: string; fecha_fin?: string; categoria?: string },
) {
  return useQuery({
    queryKey: ["dashboard", "canal-programas", canalId, params],
    queryFn: () => getCanalProgramas(canalId as string, params),
    enabled: Boolean(canalId),
  });
}
