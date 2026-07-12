/** Estilo compartido de los grupos de toggle/segmented-control del
 * dashboard (Año/Mes/Semana/Día, Búsquedas/Emisiones, Por Programa/Por
 * Auspiciador, filtros de formato/tipo/vista, etc.) — opción activa en oro
 * sólido con texto negro, inactivas en carbón con texto gris cálido, y el
 * conjunto delimitado por un borde dorado sutil en vez de separadores
 * individuales entre botones. */
export const TAB_GROUP_CLASS =
  "flex flex-wrap overflow-hidden rounded-md border border-[rgba(180,151,90,0.25)]";

export function tabButtonClass(active: boolean, extra = ""): string {
  const base = active
    ? "bg-[#b4975a] text-[#0e0c09] font-semibold"
    : "bg-[#17140f] text-[#c9bfa8] font-medium hover:bg-[#221d16]";
  return `px-2 py-1 text-xs transition-colors ${base} ${extra}`;
}
