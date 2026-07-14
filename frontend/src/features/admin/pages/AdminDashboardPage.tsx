import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminCard } from "@/features/admin/components/AdminCard";
import { StatTile } from "@/features/admin/components/StatTile";
import { useSystemSummary } from "@/features/admin/hooks/useSystemSummary";

const FILE_TYPE_LABELS: Record<string, string> = {
  DATA: "Data",
  KEYWORDS: "Keywords",
  SPLIT_SENSE: "Split Sense",
  AUSPICIOS: "Auspicios",
};

const UPLOAD_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  success: "Exitosa",
  error: "Con errores",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/** Módulo 1 (Fase 10): resumen de salud y actividad de la plataforma. */
export function AdminDashboardPage() {
  const { data, isLoading, isError, error, refetch } = useSystemSummary();

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={refetch}
      loadingFallback={<Skeleton className="h-64 w-full" />}
    >
      {data && (
        <div className="flex flex-col gap-4">
          <AdminCard title="Estado del sistema">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile
                label="API"
                value={data.api_status === "ok" ? "Operativa" : "Con problemas"}
                tone={data.api_status === "ok" ? "success" : "danger"}
              />
              <StatTile
                label="Supabase"
                value={data.database_status === "ok" ? "Conectada" : "Sin conexión"}
                tone={data.database_status === "ok" ? "success" : "danger"}
              />
              <StatTile
                label="Estado general"
                value={data.overall_status === "ok" ? "OK" : "Degradado"}
                tone={data.overall_status === "ok" ? "success" : "danger"}
              />
            </div>
          </AdminCard>

          <AdminCard title="Plataforma">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile label="Clientes" value={data.total_clientes} />
              <StatTile label="Usuarios (Clientes)" value={data.total_usuarios} />
              <StatTile label="Integrantes del equipo" value={data.total_equipo} />
            </div>
          </AdminCard>

          <AdminCard title="Actividad de datos">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Última carga de archivos
                </p>
                {data.last_upload ? (
                  <div className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                    <p>
                      {FILE_TYPE_LABELS[data.last_upload.file_type] ?? data.last_upload.file_type} —{" "}
                      {data.last_upload.original_filename}
                    </p>
                    <p className="text-neutral-500 dark:text-neutral-400">
                      {UPLOAD_STATUS_LABELS[data.last_upload.status] ?? data.last_upload.status} ·{" "}
                      {formatDateTime(data.last_upload.started_at)} ·{" "}
                      {data.last_upload.uploaded_by.full_name}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    Todavía no se cargó ningún archivo.
                  </p>
                )}
              </div>
              <div className="flex-1 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Última actualización de datos
                </p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                  {formatDateTime(data.last_update_at)}
                </p>
              </div>
            </div>
          </AdminCard>
        </div>
      )}
    </QueryState>
  );
}
