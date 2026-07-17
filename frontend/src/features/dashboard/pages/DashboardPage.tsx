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
 * El tema (oscuro por default, igual que el Power BI original) ya no
 * depende de esta página en particular: `darkMode: "class"` + ThemeProvider
 * lo aplican a toda la app vía la clase `dark` en `<html>`, con toggle
 * manual disponible en el Navbar (ver ThemeProvider).
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
