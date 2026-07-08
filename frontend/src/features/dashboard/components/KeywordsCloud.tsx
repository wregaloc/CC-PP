import { useCallback, useEffect, useMemo, useState } from "react";

import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useKeywords } from "@/features/dashboard/hooks/useKeywords";
import { MESES, mesFromFechaInicio } from "@/features/dashboard/lib/mes";
import { layoutWordCloud } from "@/features/dashboard/lib/wordCloudLayout";
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

const CLOUD_HEIGHT_PX = 288;

/** Mide el ancho disponible del contenedor con ResizeObserver — el layout de
 * la nube necesita píxeles reales (no solo CSS) para calcular colisiones.
 * Usa un callback ref (no `useRef` + efecto de una sola vez): el div real se
 * monta recién cuando QueryState deja de mostrar el Skeleton de carga, así
 * que un efecto con `[]` que lea `ref.current` al montar el componente
 * llegaría demasiado temprano y nunca detectaría el nodo. */
function useContainerWidth<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  const ref = useCallback((el: T | null) => setNode(el), []);

  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [ref, width] as const;
}

/**
 * Nube de palabras "SENTIMENT DE [PROGRAMA]" — Doc-Migración §5.1: KEYWORDS
 * ponderadas por occurrences, coloreadas por sentimiento, con filtro por
 * sentimiento. Recharts no tiene un primitivo de nube de palabras — se
 * implementa a mano con el mismo algoritmo que usan wordcloud2.js/d3-cloud
 * (espiral + detección de colisiones, ver lib/wordCloudLayout.ts) en vez de
 * agregar una librería nueva solo para este widget.
 */
export function KeywordsCloud() {
  const { filters } = useDashboardFilters();
  const [sentimiento, setSentimiento] = useState<SentimientoFiltro>("todos");
  const mes = mesFromFechaInicio(filters.fecha_inicio);
  const [containerRef, containerWidth] = useContainerWidth<HTMLDivElement>();

  const query = useKeywords({ programa: filters.programa, mes, sentimiento, limit: 60 });

  const placedWords = useMemo(() => {
    const data = query.data ?? [];
    if (data.length === 0 || containerWidth === 0) return [];

    // Quitar el "#" puede colapsar dos hashtags que en el dato de origen son
    // distintos (p. ej. "palabra" y "#palabra") en el mismo texto visible —
    // se re-agrupan por (texto, sentimiento) sumando occurrences para nunca
    // terminar con dos entradas de la misma key (eso rompía el render al
    // cambiar de tab, ver commit de agregación en el backend).
    const merged = new Map<string, { hashtag: string; sentimiento: string; occurrences: number }>();
    for (const k of data) {
      const hashtag = k.hashtag.replace(/^#+/, "");
      const key = `${hashtag}-${k.sentimiento}`;
      const existing = merged.get(key);
      if (existing) {
        existing.occurrences += k.occurrences;
      } else {
        merged.set(key, { hashtag, sentimiento: k.sentimiento, occurrences: k.occurrences });
      }
    }

    return layoutWordCloud([...merged.values()], containerWidth, CLOUD_HEIGHT_PX);
  }, [query.data, containerWidth]);

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
        isEmpty={placedWords.length === 0 && (query.data?.length ?? 0) === 0}
        emptyMessage="No hay keywords para este filtro."
        onRetry={query.refetch}
        loadingFallback={<Skeleton className="h-[18rem] w-full" />}
      >
        <div
          key={sentimiento}
          ref={containerRef}
          className="relative w-full overflow-hidden"
          style={{ height: CLOUD_HEIGHT_PX }}
          aria-label="Nube de palabras clave"
          role="img"
        >
          {placedWords.map((word) => (
            <span
              key={`${word.hashtag}-${word.sentimiento}`}
              className="absolute hover:z-10"
              style={{
                left: `calc(50% + ${word.x}px)`,
                top: `calc(50% + ${word.y}px)`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <span
                className={`inline-block cursor-default whitespace-nowrap font-bold leading-none
                  transition-transform duration-150 ease-out hover:scale-125
                  ${SENTIMIENTO_COLOR[word.sentimiento]}`}
                style={{ fontSize: `${word.fontSizePx}px` }}
                title={`${word.hashtag}: ${word.occurrences} menciones (${word.sentimiento})`}
              >
                {word.hashtag}
              </span>
            </span>
          ))}
        </div>
      </QueryState>
    </DashboardCard>
  );
}
