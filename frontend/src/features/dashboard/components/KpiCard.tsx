interface KpiCardProps {
  label: string;
  value: string;
  description?: string;
}

/** Tarjeta individual de métrica — usada tanto por los 5 KPIs principales
 * como por los 3 KPIs de sentimiento (mismo componente, ver DashboardCard
 * para el contenedor visual compartido). `description` se muestra como
 * tooltip nativo (`title`) — suficiente para una tarjeta simple, sin
 * necesidad de un componente de tooltip propio. */
export function KpiCard({ label, value, description }: KpiCardProps) {
  return (
    <div
      className="flex flex-col gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3
        dark:border-neutral-800 dark:bg-neutral-950"
      title={description}
    >
      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{value}</span>
    </div>
  );
}
