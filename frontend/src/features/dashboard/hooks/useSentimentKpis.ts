import { useQuery } from "@tanstack/react-query";

import { getSentimentKpis } from "@/features/dashboard/api/dashboardApi";
import type { DashboardFilters } from "@/features/dashboard/types";

export function useSentimentKpis(filters: Pick<DashboardFilters, "fecha_inicio" | "fecha_fin" | "programa">) {
  return useQuery({
    queryKey: ["dashboard", "sentiment-kpis", filters],
    queryFn: () => getSentimentKpis(filters),
  });
}
