import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // Dorado de marca (mismo tono que tabButtonClass/los botones del login),
  // no el azul default — antes era bg-blue-600, el único botón de la app
  // fuera de la paleta gold/carbon.
  primary: "bg-[#b4975a] text-[#0e0c09] hover:bg-[#8a6f3c] focus-visible:outline-[#b4975a]",
  secondary:
    "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 focus-visible:outline-neutral-400 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600 dark:bg-red-500 dark:hover:bg-red-600",
  ghost:
    "bg-transparent text-neutral-700 hover:bg-neutral-100 focus-visible:outline-neutral-400 dark:text-neutral-300 dark:hover:bg-neutral-800",
};

/** Botón base de la app — agnóstico de negocio (ver [[react-enterprise-frontend]]).
 * Cualquier feature lo usa vía composición, nunca lo extiende con lógica propia. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", isLoading = false, disabled, className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium
          transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
          disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className}`}
        {...props}
      >
        {isLoading && (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
