import { httpClient } from "@/lib/httpClient";

import type { PeriodoDisponibleResponse } from "@/features/dashboard/types";

export async function getFilterProgramas(): Promise<string[]> {
  const response = await httpClient.get<string[]>("/filters/programas");
  return response.data;
}

export async function getFilterCanales(): Promise<string[]> {
  const response = await httpClient.get<string[]>("/filters/canales");
  return response.data;
}

export async function getFilterCategorias(): Promise<string[]> {
  const response = await httpClient.get<string[]>("/filters/categorias");
  return response.data;
}

export async function getFilterPeriodos(): Promise<PeriodoDisponibleResponse> {
  const response = await httpClient.get<PeriodoDisponibleResponse>("/filters/periodos");
  return response.data;
}
