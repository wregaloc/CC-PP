import { useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Modal } from "@/features/admin/components/Modal";
import { useSetAdminUserPassword } from "@/features/admin/hooks/useAdminUsers";
import type { AdminUserOut } from "@/features/admin/types";
import { normalizeError } from "@/lib/apiError";

interface SetPasswordModalProps {
  user: AdminUserOut;
  onClose: () => void;
}

/** Fase 10 §Módulo 4: el Admin fija la contraseña de un usuario directamente
 * — es la única vía de gestión de credenciales para el rol Cliente. */
export function SetPasswordModal({ user, onClose }: SetPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const setPasswordMutation = useSetAdminUserPassword();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    try {
      await setPasswordMutation.mutateAsync({ userId: user.id, password });
      setSuccess(true);
    } catch (error) {
      setFormError(normalizeError(error).message);
    }
  };

  return (
    <Modal title={`Cambiar contraseña — ${user.full_name}`} onClose={onClose}>
      {success ? (
        <div className="flex flex-col gap-4">
          <Alert variant="success">
            Contraseña actualizada. Comunicásela a {user.full_name} por un canal seguro.
          </Alert>
          <div className="flex justify-end">
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {formError && <Alert variant="error">{formError}</Alert>}
          <TextField
            label="Nueva contraseña"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={setPasswordMutation.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
