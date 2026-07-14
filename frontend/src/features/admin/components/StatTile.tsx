import type { ReactNode } from "react";

interface StatTileProps {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "success" | "danger";
}

const TONE_CLASSES: Record<NonNullable<StatTileProps["tone"]>, string> = {
  neutral: "text-neutral-900 dark:text-neutral-100",
  success: "text-green-600 dark:text-green-400",
  danger: "text-red-600 dark:text-red-400",
};

/** Tile de métrica simple (label + valor grande) — usado por el Dashboard
 * del Sistema del panel de administración. */
export function StatTile({ label, value, tone = "neutral" }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <span className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <span className={`text-xl font-semibold ${TONE_CLASSES[tone]}`}>{value}</span>
    </div>
  );
}
