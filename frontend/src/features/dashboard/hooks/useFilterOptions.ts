import { useQuery } from "@tanstack/react-query";

import {
  getFilterCanales,
  getFilterCategorias,
  getFilterPeriodos,
  getFilterProgramas,
} from "@/features/dashboard/api/filtersApi";

export function useFilterProgramas() {
  return useQuery({ queryKey: ["filters", "programas"], queryFn: getFilterProgramas, staleTime: 5 * 60_000 });
}

export function useFilterCanales() {
  return useQuery({ queryKey: ["filters", "canales"], queryFn: getFilterCanales, staleTime: 5 * 60_000 });
}

export function useFilterCategorias() {
  return useQuery({
    queryKey: ["filters", "categorias"],
    queryFn: getFilterCategorias,
    staleTime: 5 * 60_000,
  });
}

export function useFilterPeriodos() {
  return useQuery({ queryKey: ["filters", "periodos"], queryFn: getFilterPeriodos, staleTime: 5 * 60_000 });
}
