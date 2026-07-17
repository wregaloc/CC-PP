import type { ReactNode } from "react";

import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { useDashboardFilters } from "@/features/dashboard/context/DashboardFiltersContext";
import { useHorarioAudiencia } from "@/features/dashboard/hooks/useHorarioAudiencia";
import { useHorarioModo } from "@/features/dashboard/hooks/useHorarioModo";
import { useKpis } from "@/features/dashboard/hooks/useKpis";
import {
  useProgramaRankingPosition,
  type RankingPosition,
} from "@/features/dashboard/hooks/useProgramaRankingPosition";
import { useSentimentKpis } from "@/features/dashboard/hooks/useSentimentKpis";
import { useSentimientoEvolutivo } from "@/features/dashboard/hooks/useSentimentoEvolutivo";
import { formatCompactNumber, formatVistasCorto } from "@/features/dashboard/lib/formatters";
import {
  construirGrillaHeatmap,
  construirGrillaHeatmapCanal,
  encontrarBloqueMax,
  encontrarBloqueMaxCanal,
  formatDiaBloque,
} from "@/features/dashboard/lib/horarioAudiencia";
import { classifyEngagementRate, formatPeriodoTexto } from "@/features/dashboard/lib/insights";
import {
  computeMomDeltaPuntos,
  computeMomRange,
  describeMomMonths,
  describeSentimentTrend,
  getDominantSentiment,
  type SentimentKey,
} from "@/features/dashboard/lib/sentimentTrend";
import type { SentimentKpisResponse, SentimientoEvolutivoPoint } from "@/features/dashboard/types";

const TIPO_PLURAL_LABEL: Record<string, string> = {
  podcast: "Podcasts",
  programa: "Programas",
};

const GOLD = "#b4975a";
const HIGHLIGHT_CLASS = "font-semibold text-[#b4975a]";

function BarChartIcon() {
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
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
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

function HeartIcon() {
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
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
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
 * (vistas, emisiones, posición en el ranking, Engagement Rate) a frases en
 * lenguaje natural. Los insights 1-3 (ranking, engagement, sentimiento)
 * solo tienen sentido para un programa/podcast puntual (comparar "posición
 * en el ranking" o "engagement" de la vista "Todos" no es una pregunta bien
 * definida), así que no se muestran sin ese filtro. El insight de "franja
 * horaria dominante" es distinto: aplica también con solo un canal
 * filtrado (ver HorarioInsightCard), porque el heatmap "Horario de Mayor
 * Audiencia" del que se deriva también se muestra en ese caso.
 */
export function InsightsPanel() {
  const { filters } = useDashboardFilters();

  if (filters.programa) {
    return <InsightsContent programa={filters.programa} />;
  }
  if (filters.canal) {
    return <CanalInsightsContent canal={filters.canal} />;
  }

  return (
    <DashboardCard title="Insights">
      <InsightCard icon={<InfoIcon />}>
        Elige un programa, podcast o canal en los filtros para ver insights.
      </InsightCard>
    </DashboardCard>
  );
}

/** Sin programa puntual: los insights 1-3 no aplican (ver comentario de
 * InsightsPanel), así que este panel solo puede ofrecer el insight de
 * horario — si el heatmap tampoco está visible para este canal (rango
 * fuera de Semana/Día), no hay nada que mostrar y se explica por qué. */
function CanalInsightsContent({ canal }: { canal: string }) {
  const { modo } = useHorarioModo();

  return (
    <DashboardCard title="Insights">
      {modo ? (
        <div className="flex flex-col gap-3">
          <HorarioInsightCard canal={canal} />
        </div>
      ) : (
        <InsightCard icon={<InfoIcon />}>
          Selecciona Semana o Día (haz clic en una barra de Evolutivo Detallado) para ver insights de
          horario de <strong className={HIGHLIGHT_CLASS}>{canal}</strong>.
        </InsightCard>
      )}
    </DashboardCard>
  );
}

function InsightsContent({ programa }: { programa: string }) {
  const { filters } = useDashboardFilters();

  const kpisQuery = useKpis(filters);
  // Sin canal/categoria a propósito: el puesto del Insight 1 es siempre el
  // ranking GLOBAL dentro del tipo del programa (decisión del usuario,
  // 15/07/2026). Si heredara esos filtros, "puesto 3" con un canal filtrado
  // significaría "3° dentro del canal" mientras la frase dice "en el ranking
  // de Podcasts" a secas — número correcto con texto engañoso.
  const rankingQuery = useProgramaRankingPosition({
    fecha_inicio: filters.fecha_inicio,
    fecha_fin: filters.fecha_fin,
    programa,
  });

  const sentimentFilters = { fecha_inicio: filters.fecha_inicio, fecha_fin: filters.fecha_fin, programa };
  const sentimentKpisQuery = useSentimentKpis(sentimentFilters);

  // Mismo mecanismo que SentimentKpiCards: la tendencia (Insight 3) se ancla
  // en fecha_fin (o fecha_inicio) y compara siempre "mes de referencia vs.
  // mes anterior", sin importar el ancho del rango filtrado — ver
  // sentimentTrend.ts.
  const referenceDate = filters.fecha_fin ?? filters.fecha_inicio;
  const momRange = computeMomRange(referenceDate);
  const momFilters = momRange
    ? { fecha_inicio: momRange.fecha_inicio, fecha_fin: momRange.fecha_fin, programa }
    : sentimentFilters;
  const momQuery = useSentimientoEvolutivo(momFilters);

  const periodoTexto = formatPeriodoTexto(filters.fecha_inicio, filters.fecha_fin);

  const posicion = rankingQuery.data;
  const tipoLabel = posicion?.tipo ? TIPO_PLURAL_LABEL[posicion.tipo] : null;

  return (
    <DashboardCard title="Insights">
      <QueryState
        isLoading={kpisQuery.isLoading || rankingQuery.isLoading || sentimentKpisQuery.isLoading}
        isError={kpisQuery.isError || rankingQuery.isError || sentimentKpisQuery.isError}
        error={kpisQuery.error ?? rankingQuery.error ?? sentimentKpisQuery.error}
        onRetry={() => {
          kpisQuery.refetch();
          rankingQuery.refetch();
          sentimentKpisQuery.refetch();
        }}
        loadingFallback={
          <div className="flex flex-col gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        }
      >
        {kpisQuery.data && sentimentKpisQuery.data && (
          <InsightSentences
            programa={programa}
            periodoTexto={periodoTexto}
            vistasTotales={kpisQuery.data.vistas_totales}
            emisiones={kpisQuery.data.emisiones}
            engagementRate={kpisQuery.data.engagement_rate}
            posicion={posicion}
            tipoLabel={tipoLabel}
            sentimentKpis={sentimentKpisQuery.data}
            // momQuery.data se pasa aunque todavía esté cargando/haya fallado:
            // si no hay datos para el mes anterior, la frase simplemente omite
            // la parte de tendencia (ver InsightSentences) en vez de bloquear
            // todo el panel por un dato que es "mejor esfuerzo".
            momData={momQuery.data}
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
  sentimentKpis: SentimentKpisResponse;
  momData: SentimientoEvolutivoPoint[] | undefined;
}

/** Insight 1 (vistas + emisiones + posición en el ranking de su categoría),
 * Insight 2 (clasificación de Engagement Rate contra benchmarks de YouTube)
 * e Insight 3 (sentimiento predominante + tendencia MoM) — separado de
 * InsightsContent solo para no anidar estos cálculos dentro del JSX. */
function InsightSentences({
  programa,
  periodoTexto,
  vistasTotales,
  emisiones,
  engagementRate,
  posicion,
  tipoLabel,
  sentimentKpis,
  momData,
}: InsightSentencesProps) {
  const engagementPct = engagementRate === null ? null : engagementRate * 100;
  const engagementClass = engagementPct === null ? null : classifyEngagementRate(engagementPct);

  const dominante = getDominantSentiment(sentimentKpis);
  const dominanteDelta = dominante ? computeMomDeltaPuntos(momData, dominante.key) : null;
  const monthsLabel = describeMomMonths(momData);

  return (
    <div className="flex flex-col gap-3">
      <InsightCard icon={<BarChartIcon />}>
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

      <InsightCard icon={<HeartIcon />}>
        {dominante === null ? (
          <>
            No hay datos de sentimiento disponibles para{" "}
            <strong className={HIGHLIGHT_CLASS}>"{programa}"</strong> en este período.
          </>
        ) : (
          <>
            {periodoTexto}, el sentimiento predominante de{" "}
            <strong className={HIGHLIGHT_CLASS}>"{programa}"</strong> fue{" "}
            <strong className={HIGHLIGHT_CLASS}>
              {dominante.label} ({dominante.valuePct.toFixed(1)}%)
            </strong>
            {dominanteDelta !== null && monthsLabel !== null && (
              <MomTrendClause deltaPuntos={dominanteDelta} sentimentKey={dominante.key} monthsLabel={monthsLabel} />
            )}
            .
          </>
        )}
      </InsightCard>

      <HorarioInsightCard programa={programa} />
    </div>
  );
}

/** Insight "franja horaria dominante" — deriva del heatmap "Horario de
 * Mayor Audiencia" (ver HorarioAudienciaPanel): usa exactamente el mismo
 * hook de modo (useHorarioModo), la misma query (useHorarioAudiencia,
 * misma queryKey → comparte caché con el heatmap, no dispara un segundo
 * fetch) y las mismas funciones de construcción de grilla
 * (construirGrillaHeatmap/construirGrillaHeatmapCanal) que pintan el
 * heatmap, para garantizar que el bloque citado acá es exactamente el que
 * el usuario ve resaltado ahí — nunca un cálculo aparte. No se muestra
 * (devuelve null) si el heatmap tampoco estaría visible (rango fuera de
 * Semana/Día) o mientras no hay datos todavía — "mejor esfuerzo", igual
 * que MomTrendClause más arriba: nunca bloquea el resto del panel. */
function HorarioInsightCard(props: { programa: string } | { canal: string }) {
  const { fecha_inicio, fecha_fin, tipo, modo } = useHorarioModo();

  const query = useHorarioAudiencia(
    "programa" in props
      ? { programa: props.programa, fecha_inicio, fecha_fin, tipo }
      : { canal: props.canal, fecha_inicio, fecha_fin, tipo },
    modo !== null,
  );

  if (!modo || !query.data) return null;

  const periodoTexto = formatPeriodoTexto(fecha_inicio, fecha_fin);

  if ("programa" in props) {
    const grilla = construirGrillaHeatmap(query.data, modo);
    const bloque = encontrarBloqueMax(grilla);
    if (!bloque) return null;
    const diaTexto = formatDiaBloque(bloque.dia, modo);

    return (
      <InsightCard icon={<ClockIcon />}>
        {periodoTexto}, el horario de mayor audiencia de{" "}
        <strong className={HIGHLIGHT_CLASS}>"{props.programa}"</strong> es{" "}
        {diaTexto && <>{diaTexto} </>}
        a las <strong className={HIGHLIGHT_CLASS}>{bloque.hora}h</strong>, con{" "}
        <strong className={HIGHLIGHT_CLASS}>{formatVistasCorto(bloque.vistas)} vistas</strong>.
      </InsightCard>
    );
  }

  const resultado = construirGrillaHeatmapCanal(query.data, modo);
  const bloque = encontrarBloqueMaxCanal(resultado.grilla);
  if (!bloque) return null;
  const diaTexto = formatDiaBloque(bloque.dia, modo);

  return (
    <InsightCard icon={<ClockIcon />}>
      {periodoTexto}, el horario de mayor audiencia de{" "}
      <strong className={HIGHLIGHT_CLASS}>{props.canal}</strong> es{" "}
      {diaTexto && <>{diaTexto} </>}
      a las <strong className={HIGHLIGHT_CLASS}>{bloque.hora}h</strong>, liderado por{" "}
      <strong className={HIGHLIGHT_CLASS}>"{bloque.programa}"</strong> con{" "}
      <strong className={HIGHLIGHT_CLASS}>{formatVistasCorto(bloque.vistas)} vistas</strong>.
    </InsightCard>
  );
}

function MomTrendClause({
  deltaPuntos,
  sentimentKey,
  monthsLabel,
}: {
  deltaPuntos: number;
  sentimentKey: SentimentKey;
  monthsLabel: string;
}) {
  const rounded = Math.round(deltaPuntos * 10) / 10;
  const verbo = describeSentimentTrend(sentimentKey, rounded);
  const sign = rounded > 0 ? "+" : "";

  return (
    <>
      {" "}
      — y en el último mes ({monthsLabel}) {verbo}{" "}
      <strong className={HIGHLIGHT_CLASS}>
        {sign}
        {rounded.toFixed(1)} p.p
      </strong>
    </>
  );
}
