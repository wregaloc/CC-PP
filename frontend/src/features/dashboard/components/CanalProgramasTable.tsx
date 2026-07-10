import { formatCompactNumber } from "@/features/dashboard/lib/formatters";
import type { CanalProgramaItem } from "@/features/dashboard/types";

interface CanalProgramasTableProps {
  items: CanalProgramaItem[];
}

/** Tabla "Programas del Canal" — Doc-Migración §5.2: misma estructura visual
 * que el ranking general, pero `CanalProgramaItem` no comparte forma con
 * `ProgramaRankingItem` (trae `pico_max`/`promedio_vivo` en vez de
 * `ranking`/`tipo`), así que es una tabla propia en vez de forzar
 * `RankingTable` a soportar dos formas de datos distintas. */
export function CanalProgramasTable({ items }: CanalProgramasTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Programas del canal seleccionado</caption>
        <thead>
          <tr className="border-b border-neutral-200 text-xs uppercase text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <th scope="col" className="py-2 pr-2">
              Programa
            </th>
            <th scope="col" className="py-2 pr-2 text-right">
              Vistas
            </th>
            <th scope="col" className="py-2 pr-2 text-right">
              Pico Max
            </th>
            <th scope="col" className="py-2 text-right">
              Promedio en Vivo
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.programa} className="border-b border-neutral-100 dark:border-neutral-800/60">
              <td className="py-2 pr-2 font-medium text-neutral-900 dark:text-neutral-100">
                {item.programa}
              </td>
              <td className="py-2 pr-2 text-right text-neutral-900 dark:text-neutral-100">
                {formatCompactNumber(item.vistas)}
              </td>
              <td className="py-2 pr-2 text-right text-neutral-600 dark:text-neutral-400">
                {item.pico_max !== null ? formatCompactNumber(item.pico_max) : "—"}
              </td>
              <td className="py-2 text-right text-neutral-600 dark:text-neutral-400">
                {item.promedio_vivo !== null ? formatCompactNumber(item.promedio_vivo) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
