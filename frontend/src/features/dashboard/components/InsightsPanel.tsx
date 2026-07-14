import type { ReactNode } from "react";

import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useKpis } from "@/features/dashboard/hooks/useKpis";
import {
  useProgramaRankingPosition,
  type RankingPosition,
} from "@/features/dashboard/hooks/useProgramaRankingPosition";
import { formatCompactNumber } from "@/features/dashboard/lib/formatters";
import { classifyEngagementRate, formatFechaLarga } from "@/features/dashboard/lib/insights";

const TIPO_PLURAL_LABEL: Record<string, string> = {
  podcast: "Podcasts",
  programa: "Programas",
};

const GOLD = "#b4975a";
const HIGHLIGHT_CLASS = "font-semibold text-[#b4975a]";

function FlagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

/** Tarjeta de un insight: barra de acento + ícono + texto, mismo acento
 * oro/carbón que InfoBanner en AuspiciosPanel — repetido acá en vez de
 * compartido porque ese componente es privado de ese archivo (ver su
 * comentario: "no se tocó ... ni otros paneles"). */
function InsightCard({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div
      className="flex items-start gap-3 rounded-md border border-[rgba(180,151,90,0.35)] bg-[rgba(180,151,90,0.08)]
        px-4 py-3 text-sm text-neutral-800
        dark:border-[rgba(180,151,90,0.25)] dark:bg-[#1a1714] dark:text-[#f5f1e8]"
    >
      <span aria-hidden="true" className="mt-0.5 w-1 shrink-0 self-stretch rounded-full bg-[#b4975a]" />
      <span className="mt-0.5 shrink-0" style={{ color: GOLD }}>
        {icon}
      </span>
      <span>{children}</span>
    </div>
  );
}

/**
 * Panel INSIGHTS — última sección del dashboard. Traduce los KPIs crudos
 * (vistas, emisiones, posición en el ranking, Engagement Rate) a dos frases
 * en lenguaje natural. Solo tiene sentido para un programa/podcast puntual
 * (comparar "posición en el ranking" o "engagement" de la vista "Todos" no
 * es una pregunta bien definida), así que no se muestra sin ese filtro.
 */
export function InsightsPanel() {
  const { filters } = useDashboardFilters();

  if (!filters.programa) {
    return (
      <DashboardCard title="Insights">
        <InsightCard icon={<InfoIcon />}>
          Elige un programa o podcast en los filtros para ver insights.
        </InsightCard>
      </DashboardCard>
    );
  }

  return <InsightsContent programa={filters.programa} />;
}

function InsightsContent({ programa }: { programa: string }) {
  const { filters } = useDashboardFilters();

  const kpisQuery = useKpis(filters);
  const rankingQuery = useProgramaRankingPosition({
    fecha_inicio: filters.fecha_inicio,
    fecha_fin: filters.fecha_fin,
    canal: filters.canal,
    categoria: filters.categoria,
    programa,
  });

  const fechaInicioLarga = formatFechaLarga(filters.fecha_inicio);
  const fechaFinLarga = formatFechaLarga(filters.fecha_fin);
  const periodoTexto =
    fechaInicioLarga && fechaFinLarga
      ? `Durante el periodo del ${fechaInicioLarga} hasta el ${fechaFinLarga}`
      : "Considerando todo el histórico disponible";

  const posicion = rankingQuery.data;
  const tipoLabel = posicion?.tipo ? TIPO_PLURAL_LABEL[posicion.tipo] : null;

  return (
    <DashboardCard title="Insights">
      <QueryState
        isLoading={kpisQuery.isLoading || rankingQuery.isLoading}
        isError={kpisQuery.isError || rankingQuery.isError}
        error={kpisQuery.error ?? rankingQuery.error}
        onRetry={() => {
          kpisQuery.refetch();
          rankingQuery.refetch();
        }}
        loadingFallback={
          <div className="flex flex-col gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        }
      >
        {kpisQuery.data && (
          <InsightSentences
            programa={programa}
            periodoTexto={periodoTexto}
            vistasTotales={kpisQuery.data.vistas_totales}
            emisiones={kpisQuery.data.emisiones}
            engagementRate={kpisQuery.data.engagement_rate}
            posicion={posicion}
            tipoLabel={tipoLabel}
          />
        )}
      </QueryState>
    </DashboardCard>
  );
}

interface InsightSentencesProps {
  programa: string;
  periodoTexto: string;
  vistasTotales: number;
  emisiones: number;
  engagementRate: number | null;
  posicion: RankingPosition | null | undefined;
  tipoLabel: string | null;
}

/** Insight 1 (vistas + emisiones + posición en el ranking de su categoría)
 * e Insight 2 (clasificación de Engagement Rate contra benchmarks de
 * YouTube) — separado de InsightsContent solo para no anidar el cálculo del
 * porcentaje de engagement dentro del JSX. */
function InsightSentences({
  programa,
  periodoTexto,
  vistasTotales,
  emisiones,
  engagementRate,
  posicion,
  tipoLabel,
}: InsightSentencesProps) {
  const engagementPct = engagementRate === null ? null : engagementRate * 100;
  const engagementClass = engagementPct === null ? null : classifyEngagementRate(engagementPct);

  return (
    <div className="flex flex-col gap-3">
      <InsightCard icon={<FlagIcon />}>
        {periodoTexto}, <strong className={HIGHLIGHT_CLASS}>"{programa}"</strong> alcanzó{" "}
        <strong className={HIGHLIGHT_CLASS}>{formatCompactNumber(vistasTotales)} vistas</strong> con{" "}
        <strong className={HIGHLIGHT_CLASS}>{formatCompactNumber(emisiones)} emisiones</strong>
        {posicion && tipoLabel ? (
          <>
            {" "}
            — ocupa el <strong className={HIGHLIGHT_CLASS}>puesto {posicion.ranking}</strong> en el
            ranking de {tipoLabel}.
          </>
        ) : (
          ". No se pudo determinar su posición en el ranking para este filtro."
        )}
      </InsightCard>

      <InsightCard icon={<ClockIcon />}>
        {engagementPct === null || engagementClass === null ? (
          <>
            No hay datos suficientes de Engagement Rate para{" "}
            <strong className={HIGHLIGHT_CLASS}>"{programa}"</strong> en este período.
          </>
        ) : (
          <>
            El Engagement Rate de <strong className={HIGHLIGHT_CLASS}>"{programa}"</strong> (
            <strong className={HIGHLIGHT_CLASS}>{engagementPct.toFixed(1)}%</strong>) se ubica en el
            rango <strong className={HIGHLIGHT_CLASS}>"{engagementClass.label}"</strong> dentro de los
            benchmarks de YouTube ({engagementClass.rangeLabel}).
          </>
        )}
      </InsightCard>
    </div>
  );
}
