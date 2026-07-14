import type { ReactNode } from "react";

interface AdminCardProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Contenedor visual común de las pantallas del panel de administración —
 * mismo look que las tarjetas del dashboard principal, pero vive dentro de
 * `features/admin` porque hoy es el único consumidor (ver
 * [[react-enterprise-frontend]] — un componente se promueve a `components/ui/`
 * recién cuando un segundo consumidor real lo necesita). */
export function AdminCard({ title, action, children, className = "" }: AdminCardProps) {
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
