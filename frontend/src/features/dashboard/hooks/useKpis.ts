import { useQuery } from "@tanstack/react-query";

import { getKpis } from "@/features/dashboard/api/dashboardApi";
import type { DashboardFilters } from "@/features/dashboard/types";

export function useKpis(filters: DashboardFilters) {
  return useQuery({
    queryKey: ["dashboard", "kpis", filters],
    queryFn: () => getKpis(filters),
  });
}
