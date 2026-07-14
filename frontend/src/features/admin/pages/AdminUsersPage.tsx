import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminCard } from "@/features/admin/components/AdminCard";
import { DataTable, type DataTableColumn } from "@/features/admin/components/DataTable";
import { PaginationControls } from "@/features/admin/components/PaginationControls";
import { SetPasswordModal } from "@/features/admin/components/SetPasswordModal";
import { StatusBadge } from "@/features/admin/components/StatusBadge";
import { UserFormModal } from "@/features/admin/components/UserFormModal";
import { useAdminClients } from "@/features/admin/hooks/useAdminClients";
import { useAdminUsers, useToggleAdminUserActive } from "@/features/admin/hooks/useAdminUsers";
import type { AdminUserOut } from "@/features/admin/types";

const PAGE_SIZE = 20;

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/** Módulo 4 (Fase 10): administración de los accesos de los usuarios
 * pertenecientes a los clientes (rol Cliente). */
export function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<AdminUserOut | "new" | null>(null);
  const [passwordUser, setPasswordUser] = useState<AdminUserOut | null>(null);

  const { data, isLoading, isError, error, refetch } = useAdminUsers({
    role: ["cliente"],
    page,
    page_size: PAGE_SIZE,
  });
  // Para mostrar el nombre del cliente en vez de solo su id.
  const clients = useAdminClients({ page: 1, pageSize: 200 });
  const clientNameById = new Map(clients.data?.items.map((client) => [client.id, client.name]));
  const toggleActive = useToggleAdminUserActive();

  const columns: DataTableColumn<AdminUserOut>[] = [
    { key: "full_name", header: "Nombre", render: (row) => row.full_name },
    { key: "email", header: "Correo", render: (row) => row.email },
    {
      key: "client",
      header: "Cliente",
      render: (row) => (row.client_id ? clientNameById.get(row.client_id) ?? "—" : "—"),
    },
    { key: "status", header: "Estado", render: (row) => <StatusBadge isActive={row.is_active} /> },
    {
      key: "created_at",
      header: "Creación",
      render: (row) => formatDateTime(row.created_at),
      hideOnMobile: true,
    },
    {
      key: "last_login_at",
      header: "Último acceso",
      render: (row) => formatDateTime(row.last_login_at),
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setEditingUser(row)}>
            Editar
          </Button>
          <Button variant="ghost" onClick={() => setPasswordUser(row)}>
            Contraseña
          </Button>
          <Button
            variant="ghost"
            onClick={() => toggleActive.mutate(row.id)}
            isLoading={toggleActive.isPending && toggleActive.variables === row.id}
          >
            {row.is_active ? "Inactivar" : "Activar"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminCard
      title="Gestión de Usuarios"
      action={<Button onClick={() => setEditingUser("new")}>Nuevo usuario</Button>}
    >
      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        loadingFallback={<Skeleton className="h-48 w-full" />}
      >
        {data && (
          <>
            <DataTable
              columns={columns}
              rows={data.items}
              getRowKey={(row) => row.id}
              emptyMessage="No hay usuarios todavía."
            />
            <PaginationControls
              page={data.page}
              pageSize={data.page_size}
              total={data.total}
              onPageChange={setPage}
            />
          </>
        )}
      </QueryState>

      {editingUser && (
        <UserFormModal
          user={editingUser === "new" ? undefined : editingUser}
          onClose={() => setEditingUser(null)}
        />
      )}
      {passwordUser && (
        <SetPasswordModal user={passwordUser} onClose={() => setPasswordUser(null)} />
      )}
    </AdminCard>
  );
}
