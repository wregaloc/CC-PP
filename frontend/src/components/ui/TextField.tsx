import { forwardRef, useId, type InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

/** Campo de texto con label + mensaje de error asociados por `aria-describedby`
 * (accesibilidad — ver [[react-enterprise-frontend]]). */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, id, className = "", ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;

    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`rounded-md border px-3 py-2 text-sm text-neutral-900 shadow-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500
            dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100
            ${error ? "border-red-500" : "border-neutral-300"} ${className}`}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  },
);
TextField.displayName = "TextField";
