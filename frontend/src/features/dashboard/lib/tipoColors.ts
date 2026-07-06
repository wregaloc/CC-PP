import type { ProgramType } from "@/features/dashboard/types";

/** Colores por DATA[Tipo] — Doc-Migración §5.1: el ranking original distingue
 * tipo de programa por color de barra (naranja=Podcast, gris=Programa),
 * ambos visibles a la vez en el mismo gráfico. */
export const TIPO_COLOR: Record<ProgramType, string> = {
  podcast: "#f97316",
  programa: "#6b7280",
};

export const TIPO_COLOR_DEFAULT = "#2563eb";

export function colorForTipo(tipo: ProgramType | null): string {
  return tipo ? TIPO_COLOR[tipo] : TIPO_COLOR_DEFAULT;
}

export const TIPO_LABEL: Record<ProgramType, string> = {
  podcast: "Podcast",
  programa: "Programa",
};
