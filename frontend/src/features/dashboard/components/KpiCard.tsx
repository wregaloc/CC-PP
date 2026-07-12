import type { ReactNode } from "react";

export type KpiAccent = "positivo" | "negativo" | "neutral";

interface KpiCardProps {
  label: string;
  value: string;
  description?: string;
  accent?: KpiAccent;
  /** Contenido opcional junto al valor grande, misma línea (p. ej. un
   * indicador de variación MoM) — ver SentimentKpiCards. */
  trailing?: ReactNode;
}

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
export function KpiCard({ label, value, description, accent, trailing }: KpiCardProps) {
  return (
    <div
      className="flex flex-col gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3
        dark:border-neutral-800 dark:bg-neutral-950"
      title={description}
    >
      <span
        className={`text-xs font-medium ${
          accent ? ACCENT_LABEL_CLASS[accent] : "text-neutral-500 dark:text-neutral-400"
        }`}
      >
        {label}
      </span>
      <span className="flex items-center gap-2">
        <span
          className={`text-xl font-semibold ${
            accent ? ACCENT_VALUE_CLASS[accent] : "text-neutral-900 dark:text-neutral-100"
          }`}
        >
          {value}
        </span>
        {trailing}
      </span>
    </div>
  );
}
