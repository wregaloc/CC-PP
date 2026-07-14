import { useQuery } from "@tanstack/react-query";

import { getSystemSummary } from "@/features/admin/api/adminSystemApi";

export function useSystemSummary() {
  return useQuery({
    queryKey: ["admin", "system-summary"],
    queryFn: getSystemSummary,
    // Refresca solo mientras la pestaña de Dashboard del Sistema está abierta
    // — es un panel de monitoreo, no datos que necesiten estar siempre en
    // segundo plano (ver [[react-enterprise-frontend]] — TanStack Query).
    refetchInterval: 30_000,
  });
}
