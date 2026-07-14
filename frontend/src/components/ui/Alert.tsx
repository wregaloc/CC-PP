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
  info: "border-[rgba(180,151,90,0.35)] bg-[rgba(180,151,90,0.08)] text-[#8a6f3c] dark:border-[rgba(180,151,90,0.25)] dark:bg-[#1a1714] dark:text-[#f5f1e8]",
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
