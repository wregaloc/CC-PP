import { useQuery } from "@tanstack/react-query";

import { getRankingProgramas } from "@/features/dashboard/api/dashboardApi";
import type { ProgramType } from "@/features/dashboard/types";

interface Params {
  fecha_inicio?: string;
  fecha_fin?: string;
  canal?: string;
  categoria?: string;
  programa: string | undefined;
}

export interface RankingPosition {
  ranking: number;
  tipo: ProgramType | null;
}

/**
 * Posición de `programa` dentro de su propia categoría (Podcast vs.
 * Programa) — no de la tabla mezclada, porque comparar un podcast contra
 * programas de TV no es una comparación justa (ver panel Insights).
 *
 * `Programa.tipo` filtra *antes* de calcular el DENSE_RANK en el backend
 * (ver dashboard_repository.py::get_ranking_programas), así que no hay forma
 * de pedir "el ranking dentro de su categoría" sin saber antes esa
 * categoría. Se resuelve con dos consultas encadenadas: la primera, sin
 * filtro de `tipo` (con `programa_asegurado` para garantizar que el
 * programa viaje en la respuesta pase lo que pase), solo para leer a qué
 * categoría pertenece; la segunda repite la consulta ya filtrada por esa
 * categoría, y ahí sí el `ranking` devuelto es el correcto.
 */
export function useProgramaRankingPosition(params: Params) {
  const { programa, ...rest } = params;

  const tipoQuery = useQuery({
    queryKey: ["dashboard", "ranking-programas", "tipo-de", programa, rest],
    queryFn: () => getRankingProgramas({ ...rest, programa_asegurado: programa, limit: 1 }),
    enabled: programa !== undefined,
    select: (items) => items.find((item) => item.programa === programa)?.tipo ?? null,
  });

  const tipo = tipoQuery.data;

  const posicionQuery = useQuery({
    queryKey: ["dashboard", "ranking-programas", "posicion-de", programa, rest, tipo],
    // tipo === null (el programa no tiene categoría asignada en la BD): se
    // pide sin filtro de tipo, mismo resultado "mezclado" que la primera
    // consulta — es el mejor esfuerzo posible sin una categoría real.
    queryFn: () =>
      getRankingProgramas({ ...rest, programa_asegurado: programa, tipo: tipo ?? undefined, limit: 1 }),
    enabled: programa !== undefined && tipoQuery.isSuccess,
    select: (items): RankingPosition | null => {
      const match = items.find((item) => item.programa === programa);
      return match ? { ranking: match.ranking, tipo: match.tipo } : null;
    },
  });

  return {
    data: posicionQuery.data,
    isLoading: tipoQuery.isLoading || posicionQuery.isLoading,
    isError: tipoQuery.isError || posicionQuery.isError,
    error: tipoQuery.error ?? posicionQuery.error,
    refetch: () => {
      void tipoQuery.refetch();
      void posicionQuery.refetch();
    },
  };
}
