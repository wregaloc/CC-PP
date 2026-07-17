import { useEffect, useState } from "react";

import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import {
  useFilterCanales,
  useFilterCategorias,
  useFilterPeriodos,
  useFilterProgramas,
} from "@/features/dashboard/hooks/useFilterOptions";
import { LastUpdateIndicator } from "@/features/dashboard/components/LastUpdateIndicator";
import { Button } from "@/components/ui/Button";
import { DateRangePicker } from "@/components/ui/DateRangePicker";

function toUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}

/**
 * Barra de filtros de la Página 1 (Doc-Migración §5.1: date picker de rango +
 * selección de programa/canal que recontextualiza varios paneles a la vez).
 * Los `<select>` se alimentan de /filters/* — nunca de una lista hardcodeada,
 * para no duplicar en el frontend datos que ya vienen del backend.
 *
 * Queda fija (`sticky`) arriba de la página para poder cambiar fecha/programa/
 * canal en cualquier momento sin volver a subir el scroll. Al hacer scroll se
 * vuelve semitransparente con blur (no se oculta ni pierde legibilidad de los
 * controles) — solo un efecto visual de "recede" para no tapar el contenido.
 */
export function FilterBar() {
  const { filters, setFechaInicio, setFechaFin, setPrograma, setCanal, setCategoria, clearFilters } =
    useDashboardFilters();
  const programasQuery = useFilterProgramas();
  const canalesQuery = useFilterCanales();
  const categoriasQuery = useFilterCategorias();
  const periodosQuery = useFilterPeriodos();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 8);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const hasActiveFilters =
    filters.fecha_inicio || filters.fecha_fin || filters.programa || filters.canal || filters.categoria;

  return (
    <div
      className={`sticky top-0 z-30 relative flex flex-wrap items-end gap-3 rounded-lg border p-4
        transition-all duration-300 ${
          isScrolled
            ? "border-neutral-200/60 bg-white/75 shadow-md backdrop-blur-md dark:border-neutral-800/60 dark:bg-neutral-900/75"
            : "border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
        }`}
    >
      <div className="absolute right-4 top-2">
        <LastUpdateIndicator />
      </div>

      <DateRangePicker
        label="Rango de fechas"
        value={{ from: filters.fecha_inicio, to: filters.fecha_fin }}
        min={periodosQuery.data?.fecha_min ?? undefined}
        max={periodosQuery.data?.fecha_max ?? undefined}
        onChange={(range) => {
          setFechaInicio(range.from);
          setFechaFin(range.to);
        }}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-canal" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Canal
        </label>
        <select
          id="filtro-canal"
          value={filters.canal ?? ""}
          onChange={(event) => setCanal(toUndefined(event.target.value))}
          className="min-w-[10rem] rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900
            dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
        >
          <option value="">Todos</option>
          {canalesQuery.data?.map((canal) => (
            <option key={canal} value={canal}>
              {canal}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-programa" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Nombre Podcast o Programa
        </label>
        <select
          id="filtro-programa"
          value={filters.programa ?? ""}
          onChange={(event) => setPrograma(toUndefined(event.target.value))}
          className="min-w-[10rem] rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900
            dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
        >
          <option value="">Todos</option>
          {programasQuery.data?.map((programa) => (
            <option key={programa} value={programa}>
              {programa}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-categoria" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Categoría
        </label>
        <select
          id="filtro-categoria"
          value={filters.categoria ?? ""}
          onChange={(event) => setCategoria(toUndefined(event.target.value))}
          className="min-w-[10rem] rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900
            dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
        >
          <option value="">Todas</option>
          {categoriasQuery.data?.map((categoria) => (
            <option key={categoria} value={categoria}>
              {categoria}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" onClick={clearFilters}>
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}
