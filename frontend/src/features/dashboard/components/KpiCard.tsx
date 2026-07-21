import type { ReactNode } from "react";

import { useContainerWidth } from "@/features/dashboard/hooks/useContainerWidth";

export type KpiAccent = "positivo" | "negativo" | "neutral";

interface KpiCardProps {
  label: string;
  value: string;
  /** Versión abreviada de `value` (p. ej. "2.4B" en vez de "2,430,146,902")
   * — si la tarjeta no tiene ancho para mostrar `value` completo sin
   * partirlo en un punto arbitrario, se usa esta en su lugar. Solo tiene
   * sentido para KPIs numéricos; se omite en KPIs de porcentaje, que ya son
   * cortos por naturaleza. */
  compactValue?: string;
  description?: string;
  accent?: KpiAccent;
  /** Contenido opcional junto al valor grande, misma línea (p. ej. un
   * indicador de variación MoM) — ver SentimentKpiCards. */
  trailing?: ReactNode;
  /** Texto chico debajo del valor, siempre visible (a diferencia de
   * `description`, que solo se ve en el tooltip nativo) — p. ej. "por
   * emisión" / "por programa" en el KPI Promedio de Vistas, para aclarar a
   * qué unidad corresponde el promedio sin que el usuario tenga que pasar
   * el mouse. */
  helperText?: string;
}

// Ancho aproximado en px de un dígito/coma a text-xl font-semibold — no es
// exacto (no hay canvas.measureText en este componente), pero alcanza para
// decidir "entra vs. no entra" sin medir cada carácter real.
const PX_PER_CHAR_ESTIMATE = 11;
// px-4 del contenedor (16px por lado).
const CARD_PADDING_PX = 32;

/** Colores de acento opcionales — convención estándar de sentimiento
 * (verde=positivo, rojo=negativo, gris=neutral). Solo lo usan los KPIs de
 * Sentimiento; los KPIs principales no pasan `accent` y mantienen el estilo
 * neutro de siempre. */
const ACCENT_LABEL_CLASS: Record<KpiAccent, string> = {
  positivo: "text-green-600 dark:text-green-400",
  negativo: "text-red-600 dark:text-red-400",
  neutral: "text-neutral-500 dark:text-neutral-400",
};

const ACCENT_VALUE_CLASS: Record<KpiAccent, string> = {
  positivo: "text-green-700 dark:text-green-400",
  negativo: "text-red-700 dark:text-red-400",
  neutral: "text-neutral-900 dark:text-neutral-100",
};

/** Tarjeta individual de métrica — usada tanto por los 5 KPIs principales
 * como por los 3 KPIs de sentimiento (mismo componente, ver DashboardCard
 * para el contenedor visual compartido). `description` se muestra como
 * tooltip nativo (`title`) — suficiente para una tarjeta simple, sin
 * necesidad de un componente de tooltip propio. */
export function KpiCard({
  label,
  value,
  compactValue,
  description,
  accent,
  trailing,
  helperText,
}: KpiCardProps) {
  const [containerRef, containerWidth] = useContainerWidth<HTMLDivElement>();
  const availableWidth = containerWidth - CARD_PADDING_PX;
  // Antes de la primera medición (containerWidth === 0) se muestra el valor
  // completo, mismo criterio que el resto de charts con esta técnica — no
  // abreviar de más en el primer render.
  const necesitaAbreviar =
    !!compactValue && containerWidth > 0 && value.length * PX_PER_CHAR_ESTIMATE > availableWidth;
  const displayValue = necesitaAbreviar ? compactValue : value;

  return (
    <div
      ref={containerRef}
      className="flex min-w-0 flex-col gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3
        dark:border-neutral-800 dark:bg-neutral-950"
      title={necesitaAbreviar ? value : description}
    >
      <span
        className={`text-xs font-medium ${
          accent ? ACCENT_LABEL_CLASS[accent] : "text-neutral-500 dark:text-neutral-400"
        }`}
      >
        {label}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={`min-w-0 break-words text-xl font-semibold ${
            accent ? ACCENT_VALUE_CLASS[accent] : "text-neutral-900 dark:text-neutral-100"
          }`}
        >
          {displayValue}
        </span>
        {trailing}
      </span>
      {helperText && <span className="text-[11px] text-neutral-400 dark:text-neutral-500">{helperText}</span>}
    </div>
  );
}
