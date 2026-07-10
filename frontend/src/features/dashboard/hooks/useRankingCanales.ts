import { useQuery } from "@tanstack/react-query";

import { getRankingCanales } from "@/features/dashboard/api/dashboardApi";

export function useRankingCanales(params: {
  fecha_inicio?: string;
  fecha_fin?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["dashboard", "ranking-canales", params],
    queryFn: () => getRankingCanales(params),
  });
}
