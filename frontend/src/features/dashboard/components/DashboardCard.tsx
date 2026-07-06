import type { ReactNode } from "react";

interface DashboardCardProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Contenedor visual común de todos los paneles/widgets del dashboard —
 * título + acción opcional (p. ej. un segmentador) + contenido. Evita
 * repetir el mismo `div` con borde/sombra/dark-mode en cada widget (ver
 * [[react-enterprise-frontend]] — reutilización, no duplicación). */
export function DashboardCard({ title, action, children, className = "" }: DashboardCardProps) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm
        dark:border-neutral-800 dark:bg-neutral-900 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
