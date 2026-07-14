import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminCard } from "@/features/admin/components/AdminCard";
import { DataTable, type DataTableColumn } from "@/features/admin/components/DataTable";
import { PaginationControls } from "@/features/admin/components/PaginationControls";
import { StatusBadge } from "@/features/admin/components/StatusBadge";
import { TeamFormModal } from "@/features/admin/components/TeamFormModal";
import { useAdminUsers, useToggleAdminUserActive } from "@/features/admin/hooks/useAdminUsers";
import type { AdminUserOut } from "@/features/admin/types";

const PAGE_SIZE = 20;

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/** Módulo 2 (Fase 10): administración del equipo interno (Admin/Interno). */
export function AdminTeamPage() {
  const [page, setPage] = useState(1);
  const [editingMember, setEditingMember] = useState<AdminUserOut | "new" | null>(null);

  const { data, isLoading, isError, error, refetch } = useAdminUsers({
    role: ["admin", "interno"],
    page,
    page_size: PAGE_SIZE,
  });
  const toggleActive = useToggleAdminUserActive();

  const columns: DataTableColumn<AdminUserOut>[] = [
    { key: "full_name", header: "Nombre", render: (row) => row.full_name },
    { key: "email", header: "Correo", render: (row) => row.email },
    { key: "cargo", header: "Cargo", render: (row) => row.cargo ?? "—", hideOnMobile: true },
    {
      key: "role",
      header: "Rol",
      render: (row) => (row.role === "admin" ? "Admin" : "Interno"),
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
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setEditingMember(row)}>
            Editar
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
      title="Gestión de Equipo"
      action={<Button onClick={() => setEditingMember("new")}>Nuevo integrante</Button>}
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
              emptyMessage="No hay integrantes de equipo todavía."
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

      {editingMember && (
        <TeamFormModal
          member={editingMember === "new" ? undefined : editingMember}
          onClose={() => setEditingMember(null)}
        />
      )}
    </AdminCard>
  );
}
