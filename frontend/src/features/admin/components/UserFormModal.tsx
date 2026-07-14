import { useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useAdminClients } from "@/features/admin/hooks/useAdminClients";
import { Modal } from "@/features/admin/components/Modal";
import { SelectField } from "@/features/admin/components/SelectField";
import { useCreateAdminUser, useUpdateAdminUser } from "@/features/admin/hooks/useAdminUsers";
import type { AdminUserOut } from "@/features/admin/types";
import { normalizeError } from "@/lib/apiError";

interface UserFormModalProps {
  /** Si se pasa, el modal edita este usuario; si no, crea uno nuevo. */
  user?: AdminUserOut;
  onClose: () => void;
}

/** Formulario de alta/edición de un usuario rol Cliente (Módulo 4): nombre,
 * correo, cliente asignado. La contraseña se gestiona aparte (ver
 * SetPasswordModal) — el rol Cliente no tiene autoservicio de credenciales. */
export function UserFormModal({ user, onClose }: UserFormModalProps) {
  const isEditing = user !== undefined;
  const [email, setEmail] = useState(user?.email ?? "");
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [clientId, setClientId] = useState(user?.client_id ?? "");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const clients = useAdminClients({ page: 1, pageSize: 200, isActive: true });
  const createMutation = useCreateAdminUser();
  const updateMutation = useUpdateAdminUser();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          userId: user.id,
          payload: { email, full_name: fullName, role: "cliente", client_id: clientId || null },
        });
      } else {
        await createMutation.mutateAsync({
          email,
          full_name: fullName,
          role: "cliente",
          password,
          client_id: clientId || null,
        });
      }
      onClose();
    } catch (error) {
      setFormError(normalizeError(error).message);
    }
  };

  return (
    <Modal title={isEditing ? "Editar usuario" : "Nuevo usuario"} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Nombre completo"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
        <TextField
          label="Correo electrónico"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <SelectField
          label="Cliente asignado"
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
        >
          <option value="">Sin cliente asignado</option>
          {clients.data?.items.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </SelectField>
        {!isEditing && (
          <TextField
            label="Contraseña inicial"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isEditing ? "Guardar cambios" : "Crear usuario"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
