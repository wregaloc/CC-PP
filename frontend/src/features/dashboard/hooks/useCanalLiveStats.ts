import { useQuery } from "@tanstack/react-query";

import { getCanalLiveStats } from "@/features/dashboard/api/dashboardApi";

export function useCanalLiveStats(
  canalId: string | undefined,
  params: { fecha_inicio?: string; fecha_fin?: string },
) {
  return useQuery({
    queryKey: ["dashboard", "canal-live-stats", canalId, params],
    queryFn: () => getCanalLiveStats(canalId as string, params),
    enabled: Boolean(canalId),
  });
}
