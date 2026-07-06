import { useQuery } from "@tanstack/react-query";

import { getAuspicios } from "@/features/dashboard/api/dashboardApi";

export function useAuspicios(params: { programa?: string; mes?: number }) {
  return useQuery({
    queryKey: ["dashboard", "auspicios", params],
    queryFn: () => getAuspicios(params),
  });
}
