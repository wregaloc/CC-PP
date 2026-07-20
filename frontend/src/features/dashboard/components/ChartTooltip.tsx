import { formatCompactNumber } from "@/features/dashboard/lib/formatters";

interface ChartTooltipItem {
  name?: string;
  value?: number | string | null;
  color?: string;
  payload?: unknown;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: ChartTooltipItem[];
  /** Por defecto muestra el label crudo (p. ej. el período del eje X);
   * pasar algo como `(l) => \`Mes: ${l}\`` para agregarle contexto. */
  labelFormatter?: (label: string | number) => string;
  /** Por defecto usa `formatCompactNumber` — pasar `formatPercent` u otro
   * formateador cuando la serie no son vistas/conteos. */
  valueFormatter?: (value: number) => string;
  /** Excluye filas puntuales antes del dedupe por nombre — usado por
   * Evolutivo Detallado para no listar la proyección en el punto de
   * empalme (que tiene valor solo para que la línea nazca pegada a la
   * última barra real, no porque ese período sea una proyección). */
  filterItem?: (item: ChartTooltipItem) => boolean;
}

/** Tooltip oscuro/dorado consistente con la marca, para reemplazar el
 * tooltip blanco por defecto de Recharts en los charts del dashboard.
 * Colapsa filas con el mismo `name` (una serie dibujada dos veces, p. ej.
 * relleno + trazo de una misma proyección, no debe listarse dos veces). */
export function ChartTooltip({
  active,
  label,
  payload,
  labelFormatter = (l) => String(l),
  valueFormatter = formatCompactNumber,
  filterItem,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const vistos = new Set<string>();
  const filas = payload.filter((item) => {
    if (item.value === null || item.value === undefined || !item.name) return false;
    if (filterItem && !filterItem(item)) return false;
    if (vistos.has(item.name)) return false;
    vistos.add(item.name);
    return true;
  });
  if (filas.length === 0) return null;
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs"
      style={{ background: "rgba(14, 12, 9, 0.94)", borderColor: "rgba(180, 151, 90, 0.3)" }}
    >
      <p className="mb-1 font-semibold text-neutral-300">{labelFormatter(label ?? "")}</p>
      {filas.map((item) => (
        <p key={item.name} className="flex items-center gap-1.5 text-neutral-200">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          {item.name}: {typeof item.value === "number" ? valueFormatter(item.value) : "—"}
        </p>
      ))}
    </div>
  );
}
