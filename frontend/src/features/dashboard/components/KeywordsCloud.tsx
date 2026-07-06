import { useMemo, useState } from "react";

import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useKeywords } from "@/features/dashboard/hooks/useKeywords";
import { MESES, mesFromFechaInicio } from "@/features/dashboard/lib/mes";
import type { SentimientoFiltro } from "@/features/dashboard/types";

const SENTIMIENTO_TABS: { value: SentimientoFiltro; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "positivo", label: "Positivo" },
  { value: "negativo", label: "Negativo" },
  { value: "neutral", label: "Neutral" },
];

const SENTIMIENTO_COLOR: Record<string, string> = {
  positivo: "text-green-600 dark:text-green-400",
  negativo: "text-red-600 dark:text-red-400",
  neutral: "text-neutral-500 dark:text-neutral-400",
};

const MIN_FONT_REM = 0.8;
const MAX_FONT_REM = 2.2;

/**
 * Nube de palabras "SENTIMENT DE [PROGRAMA]" — Doc-Migración §5.1: KEYWORDS
 * ponderadas por occurrences, coloreadas por sentimiento, con filtro por
 * sentimiento. Recharts no tiene un primitivo de nube de palabras — se
 * implementa como una lista de etiquetas HTML con tamaño proporcional
 * (enfoque estándar para este tipo de visual, evita una dependencia nueva
 * solo para un widget).
 */
export function KeywordsCloud() {
  const { filters } = useDashboardFilters();
  const [sentimiento, setSentimiento] = useState<SentimientoFiltro>("todos");
  const mes = mesFromFechaInicio(filters.fecha_inicio);

  const query = useKeywords({ programa: filters.programa, mes, sentimiento, limit: 60 });

  const sized = useMemo(() => {
    const data = query.data ?? [];
    if (data.length === 0) return [];
    const max = Math.max(...data.map((k) => k.occurrences));
    const min = Math.min(...data.map((k) => k.occurrences));
    const range = max - min || 1;
    return data.map((keyword) => ({
      ...keyword,
      fontSize: MIN_FONT_REM + ((keyword.occurrences - min) / range) * (MAX_FONT_REM - MIN_FONT_REM),
    }));
  }, [query.data]);

  const contexto = filters.programa
    ? mes
      ? `${filters.programa} en ${MESES[mes - 1]}`
      : filters.programa
    : null;
  const title = contexto ? `Sentiment de ${contexto}` : "Sentiment por Keywords";

  return (
    <DashboardCard
      title={title}
      action={
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtrar por sentimiento">
          {SENTIMIENTO_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={sentimiento === tab.value}
              onClick={() => setSentimiento(tab.value)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                sentimiento === tab.value
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      }
    >
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isEmpty={sized.length === 0}
        emptyMessage="No hay keywords para este filtro."
        onRetry={query.refetch}
        loadingFallback={<Skeleton className="h-48 w-full" />}
      >
        <ul
          className="flex min-h-[12rem] flex-wrap items-center justify-center gap-x-3 gap-y-1 p-2"
          aria-label="Nube de palabras clave"
        >
          {sized.map((keyword) => (
            <li key={`${keyword.hashtag}-${keyword.sentimiento}`}>
              <span
                className={`font-semibold leading-none ${SENTIMIENTO_COLOR[keyword.sentimiento]}`}
                style={{ fontSize: `${keyword.fontSize}rem` }}
                title={`${keyword.hashtag}: ${keyword.occurrences} menciones (${keyword.sentimiento})`}
              >
                #{keyword.hashtag}
              </span>
            </li>
          ))}
        </ul>
      </QueryState>
    </DashboardCard>
  );
}
