interface SkeletonProps {
  className?: string;
}

/** Bloque de carga neutro — el llamador controla tamaño/forma vía `className`
 * para que el skeleton coincida con el layout final (ver [[react-enterprise-frontend]],
 * evita saltos de layout al llegar los datos). */
export function Skeleton({ className = "h-4 w-full" }: SkeletonProps) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800 ${className}`}
    />
  );
}
