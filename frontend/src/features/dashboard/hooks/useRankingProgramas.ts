import { useQuery } from "@tanstack/react-query";

import { getRankingProgramas } from "@/features/dashboard/api/dashboardApi";
import type { Formato, ProgramType } from "@/features/dashboard/types";

export function useRankingProgramas(params: {
  fecha_inicio?: string;
  fecha_fin?: string;
  canal?: string;
  tipo?: ProgramType;
  formato?: Formato;
  limit?: number;
  q?: string;
  programa_asegurado?: string;
  categoria?: string;
}) {
  return useQuery({
    queryKey: ["dashboard", "ranking-programas", params],
    queryFn: () => getRankingProgramas(params),
  });
}
