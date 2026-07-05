import type { ReactNode } from "react";

type AlertVariant = "error" | "success" | "info";

interface AlertProps {
  variant?: AlertVariant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  error:
    "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900",
  success:
    "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-900",
  info: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900",
};

/** Banner de mensaje en línea (dentro de un formulario, por ejemplo) — para
 * notificaciones flotantes globales, ver components/ui/Toast.tsx. */
export function Alert({ variant = "info", children }: AlertProps) {
  return (
    <div role={variant === "error" ? "alert" : "status"} className={`rounded-md border px-4 py-3 text-sm ${VARIANT_CLASSES[variant]}`}>
      {children}
    </div>
  );
}
