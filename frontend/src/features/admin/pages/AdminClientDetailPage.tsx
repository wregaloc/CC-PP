import { Link, useParams } from "react-router-dom";

import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminCard } from "@/features/admin/components/AdminCard";
import { ClientLogoUploader } from "@/features/admin/components/ClientLogoUploader";
import { ClientUsersPanel } from "@/features/admin/components/ClientUsersPanel";
import { StatusBadge } from "@/features/admin/components/StatusBadge";
import { useAdminClient } from "@/features/admin/hooks/useAdminClients";

/** Detalle de un cliente (Módulo 3): logo + usuarios asociados. */
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
            <AdminCard
              title={data.name}
              action={<StatusBadge isActive={data.is_active} />}
            >
              <ClientLogoUploader clientId={data.id} hasLogo={data.logo_path !== null} />
            </AdminCard>

            <AdminCard title="Usuarios asociados">
              <ClientUsersPanel clientId={data.id} />
            </AdminCard>
          </>
        )}
      </QueryState>
    </div>
  );
}
