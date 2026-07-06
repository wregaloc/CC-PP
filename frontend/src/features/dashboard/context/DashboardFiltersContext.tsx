import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { DashboardFilters } from "@/features/dashboard/types";

interface DashboardFiltersContextValue {
  filters: DashboardFilters;
  setFechaInicio: (value: string | undefined) => void;
  setFechaFin: (value: string | undefined) => void;
  setPrograma: (value: string | undefined) => void;
  setCanal: (value: string | undefined) => void;
  clearFilters: () => void;
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

  const value = useMemo<DashboardFiltersContextValue>(
    () => ({
      filters: { fecha_inicio: fechaInicio, fecha_fin: fechaFin, programa, canal },
      setFechaInicio,
      setFechaFin,
      setPrograma,
      setCanal,
      clearFilters: () => {
        setFechaInicio(undefined);
        setFechaFin(undefined);
        setPrograma(undefined);
        setCanal(undefined);
      },
    }),
    [fechaInicio, fechaFin, programa, canal],
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
