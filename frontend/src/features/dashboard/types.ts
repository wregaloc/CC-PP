/** Tipos espejo de `backend/app/schemas/dashboard.py` — ver docs/API.md §4. */

export interface DateRangeFilter {
  fecha_inicio?: string;
  fecha_fin?: string;
}

export interface DashboardFilters extends DateRangeFilter {
  programa?: string;
  canal?: string;
  categoria?: string;
  tipo?: ProgramType;
}

export type Granularidad = "anio" | "mes" | "semana" | "dia";
export type MetricaSecundaria = "emisiones" | "busquedas";
export type SentimientoFiltro = "positivo" | "negativo" | "neutral" | "todos";
export type ProgramType = "podcast" | "programa";

export interface KpisResponse {
  vistas_totales: number;
  engagement_rate: number | null;
  likes: number;
  comentarios: number;
  emisiones: number;
  pico_max_vivo: number | null;
  promedio_vivo: number | null;
  programas_distintos: number;
}

export interface SentimentKpisResponse {
  pct_positivo: number | null;
  pct_negativo: number | null;
  pct_neutral: number | null;
}

export interface SentimientoEvolutivoPoint {
  mes: string;
  pct_positivo: number | null;
  pct_negativo: number | null;
  pct_neutral: number | null;
}

export interface AuspicioOut {
  auspiciador: string;
  mes_num: number;
  mes_nombre: string;
}

export interface AuspicioBusquedaItem {
  programa: string;
  canal: string;
  auspiciador: string;
  mes_num: number;
  mes_nombre: string;
}

export interface AuspiciadorTopItem {
  auspiciador: string;
  cantidad_programas: number;
}

export interface EvolutivoPoint {
  periodo: string;
  vistas_totales: number;
  metrica_secundaria: number | null;
  es_proyectado: boolean;
}

export interface ProgramaRankingItem {
  programa: string;
  canal: string;
  tipo: ProgramType | null;
  vistas_totales: number;
  ranking: number;
}

export type Formato = "Grabado" | "Vivo" | "Finalizado";

export interface KeywordOut {
  hashtag: string;
  occurrences: number;
  sentimiento: "positivo" | "negativo" | "neutral";
}

export interface PeriodoDisponibleResponse {
  fecha_min: string | null;
  fecha_max: string | null;
}

export interface HorarioAudienciaPoint {
  fecha: string;
  hora_transmision: string | null;
  vistas_diarias: number;
  programa: string;
}
