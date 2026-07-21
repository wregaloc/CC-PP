import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { TextField } from "@/components/ui/TextField";
import { AdminCard } from "@/features/admin/components/AdminCard";
import { ClientFormModal } from "@/features/admin/components/ClientFormModal";
import { DataTable, type DataTableColumn } from "@/features/admin/components/DataTable";
import { PaginationControls } from "@/features/admin/components/PaginationControls";
import { StatusBadge } from "@/features/admin/components/StatusBadge";
import { useAdminClients, useToggleClientActive } from "@/features/admin/hooks/useAdminClients";
import type { ClientOut } from "@/features/admin/types";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

/** Módulo 3 (Fase 10): administración de empresas clientes. */
export function AdminClientsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editingClient, setEditingClient] = useState<ClientOut | "new" | null>(null);

  const { data, isLoading, isError, error, refetch } = useAdminClients({ page, search });
  const toggleActive = useToggleClientActive();

  const columns: DataTableColumn<ClientOut>[] = [
    {
      key: "name",
      header: "Nombre",
      render: (row) => (
        <Link to={`/admin/clientes/${row.id}`} className="font-medium text-blue-700 hover:underline dark:text-blue-400">
          {row.name}
        </Link>
      ),
    },
    { key: "status", header: "Estado", render: (row) => <StatusBadge isActive={row.is_active} /> },
    { key: "user_count", header: "Usuarios", render: (row) => row.user_count },
    {
      key: "created_at",
      header: "Creación",
      render: (row) => formatDate(row.created_at),
      hideOnMobile: true,
    },
    {
      key: "updated_at",
      header: "Actualización",
      render: (row) => formatDate(row.updated_at),
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setEditingClient(row)}>
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
      title="Gestión de Clientes"
      action={<Button onClick={() => setEditingClient("new")}>Nuevo cliente</Button>}
    >
      <div className="mb-2 max-w-xs">
        <TextField
          label="Buscar por nombre"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>

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
              emptyMessage="No hay clientes todavía."
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

      {editingClient && (
        <ClientFormModal
          client={editingClient === "new" ? undefined : editingClient}
          onClose={() => setEditingClient(null)}
        />
      )}
    </AdminCard>
  );
}
