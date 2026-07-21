import { Link, useParams } from "react-router-dom";

import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminCard } from "@/features/admin/components/AdminCard";
import { ClientUsersPanel } from "@/features/admin/components/ClientUsersPanel";
import { StatusBadge } from "@/features/admin/components/StatusBadge";
import { useAdminClient } from "@/features/admin/hooks/useAdminClients";

/** Detalle de un cliente (Módulo 3): nombre/estado + usuarios asociados. */
export function AdminClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { data, isLoading, isError, error, refetch } = useAdminClient(clientId);

  return (
    <div className="flex flex-col gap-4">
      <Link to="/admin/clientes" className="text-sm text-blue-700 hover:underline dark:text-blue-400">
        ← Volver a Clientes
      </Link>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        loadingFallback={<Skeleton className="h-64 w-full" />}
      >
        {data && (
          <>
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {data.name}
              </h1>
              <StatusBadge isActive={data.is_active} />
            </div>

            <AdminCard title="Usuarios asociados">
              <ClientUsersPanel clientId={data.id} />
            </AdminCard>
          </>
        )}
      </QueryState>
    </div>
  );
}
