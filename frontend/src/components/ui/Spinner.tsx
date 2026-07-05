interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
}

const SIZE_CLASSES: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-4",
};

export function Spinner({ size = "md", label = "Cargando…" }: SpinnerProps) {
  return (
    <div role="status" className="inline-flex items-center gap-2">
      <span
        className={`animate-spin rounded-full border-neutral-300 border-t-blue-600 dark:border-neutral-700 dark:border-t-blue-400 ${SIZE_CLASSES[size]}`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Pantalla completa de carga — usada mientras se resuelve el arranque de
 * sesión, para no parpadear a /login antes de confirmar si hay una sesión válida. */
export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-neutral-950">
      <Spinner size="lg" label="Cargando la aplicación…" />
    </div>
  );
}
