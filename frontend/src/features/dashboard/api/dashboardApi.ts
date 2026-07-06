import { httpClient } from "@/lib/httpClient";

import type {
  AuspicioOut,
  DashboardFilters,
  EvolutivoPoint,
  Formato,
  Granularidad,
  KeywordOut,
  KpisResponse,
  MetricaSecundaria,
  ProgramaRankingItem,
  ProgramType,
  SentimentKpisResponse,
  SentimientoFiltro,
} from "@/features/dashboard/types";

export async function getKpis(filters: DashboardFilters): Promise<KpisResponse> {
  const response = await httpClient.get<KpisResponse>("/dashboard/kpis", { params: filters });
  return response.data;
}

export async function getSentimentKpis(
  filters: Pick<DashboardFilters, "fecha_inicio" | "fecha_fin" | "programa">,
): Promise<SentimentKpisResponse> {
  const response = await httpClient.get<SentimentKpisResponse>("/dashboard/sentiment-kpis", {
    params: filters,
  });
  return response.data;
}

export async function getAuspicios(params: {
  programa?: string;
  mes?: number;
}): Promise<AuspicioOut[]> {
  const response = await httpClient.get<AuspicioOut[]>("/dashboard/auspicios", { params });
  return response.data;
}

export async function getEvolutivo(
  filters: DashboardFilters & { granularidad: Granularidad; metrica_secundaria: MetricaSecundaria },
): Promise<EvolutivoPoint[]> {
  const response = await httpClient.get<EvolutivoPoint[]>("/dashboard/evolutivo", {
    params: filters,
  });
  return response.data;
}

export async function getRankingProgramas(params: {
  fecha_inicio?: string;
  fecha_fin?: string;
  canal?: string;
  tipo?: ProgramType;
  formato?: Formato;
  limit?: number;
}): Promise<ProgramaRankingItem[]> {
  const response = await httpClient.get<ProgramaRankingItem[]>("/dashboard/ranking/programas", {
    params,
  });
  return response.data;
}

export async function getKeywords(params: {
  programa?: string;
  mes?: number;
  sentimiento?: SentimientoFiltro;
  limit?: number;
}): Promise<KeywordOut[]> {
  const response = await httpClient.get<KeywordOut[]>("/dashboard/keywords", { params });
  return response.data;
}
