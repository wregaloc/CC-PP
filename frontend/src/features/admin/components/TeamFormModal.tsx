import { useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Modal } from "@/features/admin/components/Modal";
import { SelectField } from "@/features/admin/components/SelectField";
import { useCreateAdminUser, useUpdateAdminUser } from "@/features/admin/hooks/useAdminUsers";
import type { AdminUserOut } from "@/features/admin/types";
import { normalizeError } from "@/lib/apiError";

interface TeamFormModalProps {
  /** Si se pasa, el modal edita este integrante; si no, crea uno nuevo. */
  member?: AdminUserOut;
  onClose: () => void;
}

/** Formulario de alta/edición de un integrante del equipo interno (Módulo 2:
 * rol admin/interno + cargo). La contraseña inicial solo se pide al crear —
 * cambiarla después es responsabilidad del Módulo 4 (Gestión de Usuarios). */
export function TeamFormModal({ member, onClose }: TeamFormModalProps) {
  const isEditing = member !== undefined;
  const [email, setEmail] = useState(member?.email ?? "");
  const [fullName, setFullName] = useState(member?.full_name ?? "");
  const [cargo, setCargo] = useState(member?.cargo ?? "");
  const [role, setRole] = useState<"admin" | "interno">(
    member?.role === "admin" ? "admin" : "interno",
  );
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useCreateAdminUser();
  const updateMutation = useUpdateAdminUser();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          userId: member.id,
          payload: { email, full_name: fullName, role, cargo: cargo || null },
        });
      } else {
        await createMutation.mutateAsync({
          email,
          full_name: fullName,
          role,
          password,
          cargo: cargo || null,
        });
      }
      onClose();
    } catch (error) {
      setFormError(normalizeError(error).message);
    }
  };

  return (
    <Modal title={isEditing ? "Editar integrante" : "Nuevo integrante"} onClose={onClose}>
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
        <TextField
          label="Cargo"
          value={cargo}
          onChange={(event) => setCargo(event.target.value)}
        />
        <SelectField
          label="Rol"
          value={role}
          onChange={(event) => setRole(event.target.value as "admin" | "interno")}
        >
          <option value="interno">Interno</option>
          <option value="admin">Admin</option>
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
            {isEditing ? "Guardar cambios" : "Crear integrante"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
