import { AuspiciosPanel } from "@/features/dashboard/components/AuspiciosPanel";
import { EvolutivoDetalladoChart } from "@/features/dashboard/components/EvolutivoDetalladoChart";
import { FilterBar } from "@/features/dashboard/components/FilterBar";
import { HorarioAudienciaPanel } from "@/features/dashboard/components/HorarioAudienciaPanel";
import { InsightsPanel } from "@/features/dashboard/components/InsightsPanel";
import { KeywordsCloud } from "@/features/dashboard/components/KeywordsCloud";
import { KpiRow } from "@/features/dashboard/components/KpiRow";
import { RankingProgramasPanel } from "@/features/dashboard/components/RankingProgramasPanel";
import { SentimentKpiCards } from "@/features/dashboard/components/SentimentKpiCards";
import { DashboardFiltersProvider } from "@/features/dashboard/context/DashboardFiltersContext";

/**
 * Página 1 — Vista General / Ranking (Doc-Migración §5.1).
 *
 * Diferencia deliberada frente al original: el Power BI original tenía esta
 * página con fondo negro fijo, independiente del tema del sistema. Esta app
 * usa `darkMode: "media"` (sigue `prefers-color-scheme`) en toda la
 * aplicación — forzar un fondo oscuro fijo solo en esta página requeriría
 * cambiar la estrategia de dark mode del proyecto (a `class`) para una sola
 * página, lo cual es un cambio de arquitectura de theming no solicitado. Se
 * documenta como diferencia conocida en el informe final en vez de
 * implementarlo en silencio.
 */
export function DashboardPage() {
  return (
    <DashboardFiltersProvider>
      <div className="flex flex-col gap-4">
        <FilterBar />
        <KpiRow />

        <EvolutivoDetalladoChart />
        <HorarioAudienciaPanel />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <RankingProgramasPanel className="md:col-span-2" />
          <AuspiciosPanel />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <KeywordsCloud />
          <SentimentKpiCards />
        </div>

        <InsightsPanel />
      </div>
    </DashboardFiltersProvider>
  );
}
