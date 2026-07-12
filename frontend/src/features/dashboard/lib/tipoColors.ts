import type { ProgramType } from "@/features/dashboard/types";

/** Colores por DATA[Tipo] — Doc-Migración §5.1: el ranking original distingue
 * tipo de programa por color de barra (naranja=Podcast, gris=Programa),
 * ambos visibles a la vez en el mismo gráfico. */
export const TIPO_COLOR: Record<ProgramType, string> = {
  podcast: "#8a6f3c",
  programa: "#6b7280",
};

/** Programas con `tipo` nulo en el dato de origen (columna "Tipo" vacía en
 * DATA.csv, ver decisión con el usuario) se tratan como "Programa" para
 * color y etiqueta — no como una categoría aparte. */
export function colorForTipo(tipo: ProgramType | null): string {
  return TIPO_COLOR[tipo ?? "programa"];
}

export const TIPO_LABEL: Record<ProgramType, string> = {
  podcast: "Podcast",
  programa: "Programa",
};

export function labelForTipo(tipo: ProgramType | null): string {
  return TIPO_LABEL[tipo ?? "programa"];
}
