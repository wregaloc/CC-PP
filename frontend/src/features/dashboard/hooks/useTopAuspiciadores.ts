import { useQuery } from "@tanstack/react-query";

import { getTopAuspiciadores } from "@/features/dashboard/api/dashboardApi";

export function useTopAuspiciadores(limit = 5, enabled = true) {
  return useQuery({
    queryKey: ["dashboard", "auspicios", "top", limit],
    queryFn: () => getTopAuspiciadores(limit),
    enabled,
  });
}
