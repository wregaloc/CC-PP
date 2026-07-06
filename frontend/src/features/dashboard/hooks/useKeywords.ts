import { useQuery } from "@tanstack/react-query";

import { getKeywords } from "@/features/dashboard/api/dashboardApi";
import type { SentimientoFiltro } from "@/features/dashboard/types";

export function useKeywords(params: {
  programa?: string;
  mes?: number;
  sentimiento?: SentimientoFiltro;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["dashboard", "keywords", params],
    queryFn: () => getKeywords(params),
  });
}
