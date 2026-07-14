import { forwardRef, useId, type SelectHTMLAttributes } from "react";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

/** Select con label asociado — mismo patrón de accesibilidad que
 * components/ui/TextField.tsx, usado por los formularios de Equipo/Usuarios
 * del panel de administración (rol, cliente asignado). */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, id, className = "", children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={selectId} className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {label}
        </label>
        <select
          ref={ref}
          id={selectId}
          className={`rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500
            dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 ${className}`}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  },
);
SelectField.displayName = "SelectField";
