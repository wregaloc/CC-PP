import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { SelectField } from "@/features/admin/components/SelectField";
import { useAdminUsers, useUpdateAdminUser } from "@/features/admin/hooks/useAdminUsers";
import { useClientUsers } from "@/features/admin/hooks/useAdminClients";

interface ClientUsersPanelProps {
  clientId: string;
}

/** Usuarios asociados a un cliente (Módulo 3): visualiza los ya asignados y
 * permite asignar uno nuevo (de los usuarios rol Cliente sin empresa
 * asignada) o quitar la asignación — reutiliza PUT /admin/users/{id}
 * (ver [[react-enterprise-frontend]] — reutilización antes que un endpoint nuevo). */
export function ClientUsersPanel({ clientId }: ClientUsersPanelProps) {
  const [selectedUserId, setSelectedUserId] = useState("");

  const assigned = useClientUsers(clientId);
  // page_size=200: el universo de usuarios rol Cliente sin asignar es acotado
  // en esta etapa del proyecto — no justifica un selector paginado propio.
  const allClienteUsers = useAdminUsers({ role: ["cliente"], page_size: 200 });
  const updateUser = useUpdateAdminUser();

  const unassigned = (allClienteUsers.data?.items ?? []).filter((user) => user.client_id === null);

  const handleAssign = () => {
    const user = unassigned.find((item) => item.id === selectedUserId);
    if (!user) return;
    updateUser.mutate(
      {
        userId: user.id,
        payload: { email: user.email, full_name: user.full_name, role: user.role, client_id: clientId },
      },
      { onSuccess: () => setSelectedUserId("") },
    );
  };

  const handleUnassign = (userId: string) => {
    const user = assigned.data?.items.find((item) => item.id === userId);
    if (!user) return;
    updateUser.mutate({
      userId: user.id,
      payload: { email: user.email, full_name: user.full_name, role: user.role, client_id: null },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <QueryState
        isLoading={assigned.isLoading}
        isError={assigned.isError}
        error={assigned.error}
        onRetry={assigned.refetch}
        loadingFallback={<Skeleton className="h-24 w-full" />}
      >
        {assigned.data && (
          <ul className="flex flex-col gap-2">
            {assigned.data.items.length === 0 && (
              <li className="text-sm text-neutral-500 dark:text-neutral-400">
                Todavía no hay usuarios asignados a este cliente.
              </li>
            )}
            {assigned.data.items.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
              >
                <span>
                  {user.full_name} <span className="text-neutral-500 dark:text-neutral-400">({user.email})</span>
                </span>
                <Button
                  variant="ghost"
                  onClick={() => handleUnassign(user.id)}
                  isLoading={updateUser.isPending && updateUser.variables?.userId === user.id}
                >
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </QueryState>

      <div className="flex items-end gap-2">
        <div className="max-w-xs flex-1">
          <SelectField
            label="Asignar usuario existente"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
          >
            <option value="">Seleccionar usuario sin cliente asignado…</option>
            {unassigned.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name} ({user.email})
              </option>
            ))}
          </SelectField>
        </div>
        <Button
          onClick={handleAssign}
          disabled={!selectedUserId}
          isLoading={updateUser.isPending && updateUser.variables?.payload.client_id === clientId}
        >
          Asignar
        </Button>
      </div>
    </div>
  );
}
