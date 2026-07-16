import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { DashboardFilters, Granularidad, ProgramType } from "@/features/dashboard/types";

interface DashboardFiltersContextValue {
  filters: DashboardFilters;
  setFechaInicio: (value: string | undefined) => void;
  setFechaFin: (value: string | undefined) => void;
  setPrograma: (value: string | undefined) => void;
  setCanal: (value: string | undefined) => void;
  setCategoria: (value: string | undefined) => void;
  // Compartido con Ranking de Programas y Evolutivo Detallado — el toggle
  // Todos/Podcast/Programa del Ranking vive acá (no local a ese panel) para
  // que Evolutivo Detallado también filtre por tipo al mismo tiempo.
  setTipo: (value: ProgramType | undefined) => void;
  clearFilters: () => void;
  // Compartida entre Evolutivo Detallado y Horario de Mayor Audiencia — este
  // último necesita saber qué granularidad está activa en el primero (ver
  // panel Horario, condición de visibilidad por Semana/Día).
  granularidad: Granularidad;
  setGranularidad: (value: Granularidad) => void;
}

const DashboardFiltersContext = createContext<DashboardFiltersContextValue | undefined>(undefined);

/**
 * Estado de filtros compartido de la Página 1 (rango de fechas, programa,
 * canal) — ver Doc-Migración §5.1. Cada widget decide qué subconjunto de
 * estos filtros le aplica a su propio endpoint (no todos aceptan `canal`,
 * por ejemplo); este contexto solo centraliza el estado, no la lógica de
 * negocio de cada consulta.
 */
export function DashboardFiltersProvider({ children }: { children: ReactNode }) {
  const [fechaInicio, setFechaInicio] = useState<string | undefined>(undefined);
  const [fechaFin, setFechaFin] = useState<string | undefined>(undefined);
  const [programa, setPrograma] = useState<string | undefined>(undefined);
  const [canal, setCanal] = useState<string | undefined>(undefined);
  const [categoria, setCategoria] = useState<string | undefined>(undefined);
  const [tipo, setTipo] = useState<ProgramType | undefined>(undefined);
  const [granularidad, setGranularidad] = useState<Granularidad>("mes");

  const value = useMemo<DashboardFiltersContextValue>(
    () => ({
      filters: { fecha_inicio: fechaInicio, fecha_fin: fechaFin, programa, canal, categoria, tipo },
      setFechaInicio,
      setFechaFin,
      setPrograma,
      setCanal,
      setCategoria,
      setTipo,
      clearFilters: () => {
        setFechaInicio(undefined);
        setFechaFin(undefined);
        setPrograma(undefined);
        setCanal(undefined);
        setCategoria(undefined);
        setTipo(undefined);
      },
      granularidad,
      setGranularidad,
    }),
    [fechaInicio, fechaFin, programa, canal, categoria, tipo, granularidad],
  );

  return (
    <DashboardFiltersContext.Provider value={value}>{children}</DashboardFiltersContext.Provider>
  );
}

export function useDashboardFilters(): DashboardFiltersContextValue {
  const context = useContext(DashboardFiltersContext);
  if (!context) {
    throw new Error("useDashboardFilters debe usarse dentro de <DashboardFiltersProvider>");
  }
  return context;
}
