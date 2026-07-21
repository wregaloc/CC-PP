import { useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Modal } from "@/features/admin/components/Modal";
import { useCreateClient, useUpdateClient } from "@/features/admin/hooks/useAdminClients";
import type { ClientOut } from "@/features/admin/types";
import { normalizeError } from "@/lib/apiError";

interface ClientFormModalProps {
  /** Si se pasa, el modal edita este cliente; si no, crea uno nuevo. */
  client?: ClientOut;
  onClose: () => void;
}

/** Formulario de alta/edición de una empresa cliente (Módulo 3). */
export function ClientFormModal({ client, onClose }: ClientFormModalProps) {
  const isEditing = client !== undefined;
  const [name, setName] = useState(client?.name ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ clientId: client.id, name });
      } else {
        await createMutation.mutateAsync(name);
      }
      onClose();
    } catch (error) {
      setFormError(normalizeError(error).message);
    }
  };

  return (
    <Modal title={isEditing ? "Editar cliente" : "Nuevo cliente"} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <TextField
          label="Nombre de la empresa"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isEditing ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
