interface StatusBadgeProps {
  isActive: boolean;
}

/** Insignia de estado activo/inactivo reutilizada por las tablas de Equipo,
 * Clientes y Usuarios del panel de administración. */
export function StatusBadge({ isActive }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isActive
          ? "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300"
          : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
      }`}
    >
      {isActive ? "Activo" : "Inactivo"}
    </span>
  );
}
